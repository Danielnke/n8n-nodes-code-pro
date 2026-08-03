/**
 * Native Python execution for Code Pro.
 *
 * This is deliberately a process boundary, not a sandbox. The child inherits
 * the n8n environment and runs with the same OS permissions as n8n.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import type { CodeProMode } from '../execution/types';
import {
	DEFAULT_PYTHON_HTTP_RESPONSE_BYTES,
	PYTHON_GRACEFUL_KILL_MS,
	PYTHON_PROTOCOL_NAME,
	PYTHON_PROTOCOL_VERSION,
} from './limits';
import {
	resolvePythonInterpreter,
	type PythonInterpreter,
} from './interpreter';

type RunnerErrorType =
	| 'syntax'
	| 'indentation'
	| 'import'
	| 'runtime'
	| 'serialization'
	| 'protocol'
	| 'timeout'
	| 'cancelled'
	| 'process_exit'
	| 'python_unavailable';

interface ProtocolError {
	type?: unknown;
	message?: unknown;
	userLine?: unknown;
	traceback?: unknown;
	itemIndex?: unknown;
}

interface ProtocolItemSuccess {
	ok: true;
	value: unknown;
}

interface ProtocolItemFailure {
	ok: false;
	error: ProtocolError;
}

interface ProtocolResponse {
	protocol?: unknown;
	version?: unknown;
	ok?: unknown;
	result?: unknown;
	results?: unknown;
	error?: ProtocolError;
}

export interface PythonRunOptions {
	code: string;
	mode: CodeProMode;
	items: INodeExecutionData[];
	timeoutSec: number;
	continueOnFail: boolean;
	explicitExecutable?: string;
	maxProtocolBytes: number;
	maxLogBytes: number;
	cancelSignal?: AbortSignal;
	onExecutionCancellation?: (handler: () => unknown) => void;
}

export interface PythonLogOutput {
	stdout: string;
	stderr: string;
	truncated: boolean;
}

export interface PythonItemResult {
	ok: boolean;
	value?: unknown;
	error?: PythonRunnerError;
}

export interface PythonExecutionResult {
	mode: CodeProMode;
	result?: unknown;
	results?: PythonItemResult[];
	logs: PythonLogOutput;
	interpreter: PythonInterpreter;
}

export class PythonRunnerError extends Error {
	readonly code = 'ERR_CODE_PRO_PYTHON';

	constructor(
		public readonly errorType: RunnerErrorType,
		message: string,
		public readonly details: {
			userLine?: number;
			traceback?: string;
			itemIndex?: number;
			stdout?: string;
			stderr?: string;
			logsTruncated?: boolean;
			exitCode?: number | null;
			signal?: NodeJS.Signals | null;
		} = {},
	) {
		super(message);
		this.name = 'PythonRunnerError';
	}
}

export function isPythonRunnerError(error: unknown): error is PythonRunnerError {
	return error instanceof PythonRunnerError;
}

class BoundedCollector {
	private readonly chunks: Buffer[] = [];
	private retained = 0;
	truncated = false;

	constructor(private readonly limit: number) {}

	append(chunk: Buffer | string): void {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		const available = this.limit - this.retained;
		if (available <= 0) {
			this.truncated = true;
			return;
		}
		if (buffer.length > available) {
			this.chunks.push(buffer.subarray(0, available));
			this.retained += available;
			this.truncated = true;
			return;
		}
		this.chunks.push(buffer);
		this.retained += buffer.length;
	}

	get text(): string {
		const value = Buffer.allocUnsafe(this.retained);
		let offset = 0;
		for (const chunk of this.chunks) {
			value.set(chunk, offset);
			offset += chunk.length;
		}
		return value.toString('utf8');
	}

	get wasTruncated(): boolean {
		return this.truncated;
	}

	get byteLength(): number {
		return this.retained;
	}
}

function bootstrapPath(): string {
	const path = join(__dirname, 'bootstrap.py');
	if (!existsSync(path)) {
		throw new PythonRunnerError(
			'process_exit',
			'Code Pro Python runtime files are missing from this installation. Reinstall the package and restart n8n.',
		);
	}
	return path;
}

function jsonPayload(value: unknown, maxBytes: number, direction: 'input' | 'output'): Buffer {
	let serialized: string;
	try {
		serialized = JSON.stringify(value);
	} catch (error) {
		throw new PythonRunnerError(
			'protocol',
			`Unable to serialize Python protocol ${direction}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	const payload = Buffer.from(serialized, 'utf8');
	if (payload.length > maxBytes) {
		throw new PythonRunnerError(
			'protocol',
			`Python protocol ${direction} is ${payload.length} bytes, exceeding the configured limit of ${maxBytes} bytes. Reduce input/output data or raise Options > Python > Max Python Protocol Size.`,
		);
	}
	return payload;
}

function redactEnvironmentValues(value: string): string {
	let redacted = value;
	const secrets = Object.values(process.env)
		.filter((entry): entry is string => typeof entry === 'string' && entry.length >= 4)
		.sort((a, b) => b.length - a.length);
	for (const secret of secrets) {
		if (redacted.includes(secret)) redacted = redacted.split(secret).join('[REDACTED]');
	}
	return redacted;
}

function collectLogs(stdout: BoundedCollector, stderr: BoundedCollector, log: BoundedCollector): PythonLogOutput {
	return {
		stdout: redactEnvironmentValues(log.text),
		stderr: redactEnvironmentValues(stderr.text),
		truncated: stdout.wasTruncated || stderr.wasTruncated || log.wasTruncated,
	};
}

function runnerErrorDetails(
	logs: PythonLogOutput,
	exitCode?: number | null,
	signal?: NodeJS.Signals | null,
) {
	return {
		stdout: logs.stdout,
		stderr: logs.stderr,
		logsTruncated: logs.truncated,
		exitCode,
		signal,
	};
}

function protocolErrorToRunnerError(error: ProtocolError | undefined, logs: PythonLogOutput): PythonRunnerError {
	const type = typeof error?.type === 'string' ? error.type : 'runtime';
	const mappedType: RunnerErrorType =
		type === 'SyntaxError'
			? 'syntax'
			: type === 'IndentationError'
				? 'indentation'
				: type === 'ImportError' || type === 'ModuleNotFoundError'
					? 'import'
					: type === 'SerializationError'
						? 'serialization'
						: type === 'ProtocolError'
							? 'protocol'
							: 'runtime';
	const message = typeof error?.message === 'string' ? error.message : 'Python execution failed.';
	const userLine = typeof error?.userLine === 'number' ? error.userLine : undefined;
	const itemIndex = typeof error?.itemIndex === 'number' ? error.itemIndex : undefined;
	const traceback = typeof error?.traceback === 'string' ? redactEnvironmentValues(error.traceback) : undefined;
	return new PythonRunnerError(
		mappedType,
		`Python ${type}${userLine === undefined ? '' : ` at line ${userLine}`}: ${message}`,
		{
			userLine,
			itemIndex,
			traceback,
			stdout: logs.stdout,
			stderr: logs.stderr,
			logsTruncated: logs.truncated,
		},
	);
}

function parseResponse(payload: string): ProtocolResponse {
	const lines = payload.trim().split(/\r?\n/).filter(Boolean);
	if (lines.length !== 1) {
		throw new PythonRunnerError(
			'protocol',
			'Python produced an invalid protocol response. User print output is captured separately; do not write directly to the process protocol stream.',
		);
	}
	try {
		const response = JSON.parse(lines[0]) as ProtocolResponse;
		if (
			response.protocol !== PYTHON_PROTOCOL_NAME ||
			response.version !== PYTHON_PROTOCOL_VERSION ||
			typeof response.ok !== 'boolean'
		) {
			throw new Error('unexpected protocol version');
		}
		return response;
	} catch (error) {
		throw new PythonRunnerError(
			'protocol',
			`Python produced an invalid protocol response: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function waitForExit(child: ChildProcess): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
	return new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('exit', (code, signal) => resolve({ code, signal }));
	});
}

function runTaskkill(pid: number, force: boolean): Promise<void> {
	return new Promise((resolve) => {
		const args = ['/PID', String(pid), '/T'];
		if (force) args.push('/F');
		const taskkill = spawn('taskkill', args, {
			shell: false,
			windowsHide: true,
			stdio: 'ignore',
		});
		taskkill.once('error', () => resolve());
		taskkill.once('exit', () => resolve());
	});
}

async function terminateProcessTree(child: ChildProcess): Promise<void> {
	if (!child.pid || child.exitCode !== null) return;
	if (process.platform === 'win32') {
		await runTaskkill(child.pid, false);
		await new Promise((resolve) => setTimeout(resolve, PYTHON_GRACEFUL_KILL_MS));
		if (child.exitCode === null) await runTaskkill(child.pid, true);
		return;
	}
	try {
		process.kill(-child.pid, 'SIGTERM');
	} catch {
		try {
			child.kill('SIGTERM');
		} catch {
			return;
		}
	}
	await new Promise((resolve) => setTimeout(resolve, PYTHON_GRACEFUL_KILL_MS));
	if (child.exitCode === null) {
		try {
			process.kill(-child.pid, 'SIGKILL');
		} catch {
			try {
				child.kill('SIGKILL');
			} catch {
				// Already exited.
			}
		}
	}
}

function attachLogs(child: ChildProcess, maxProtocolBytes: number, maxLogBytes: number) {
	const protocol = new BoundedCollector(maxProtocolBytes);
	const stderr = new BoundedCollector(maxLogBytes);
	const log = new BoundedCollector(maxLogBytes);
	child.stdout?.on('data', (chunk: Buffer) => protocol.append(chunk));
	child.stderr?.on('data', (chunk: Buffer) => stderr.append(chunk));
	const logStream = child.stdio[3];
	if (logStream && 'on' in logStream) {
		(logStream as NodeJS.ReadableStream).on('data', (chunk: Buffer) => log.append(chunk));
	}
	return { protocol, stderr, log };
}

export async function runPythonCode(options: PythonRunOptions): Promise<PythonExecutionResult> {
	const resolution = await resolvePythonInterpreter({ explicitExecutable: options.explicitExecutable });
	const request = {
		protocol: PYTHON_PROTOCOL_NAME,
		version: PYTHON_PROTOCOL_VERSION,
		code: options.code,
		mode: options.mode,
		items: options.items,
		continueOnFail: options.continueOnFail,
		protocolByteLimit: options.maxProtocolBytes,
		httpResponseByteLimit: DEFAULT_PYTHON_HTTP_RESPONSE_BYTES,
	};
	const input = jsonPayload(request, options.maxProtocolBytes, 'input');
	const child = spawn(
		resolution.interpreter.command,
		[...resolution.interpreter.args, '-u', bootstrapPath()],
		{
			shell: false,
			windowsHide: true,
			detached: process.platform !== 'win32',
			env: process.env,
			stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
		},
	);
	const collectors = attachLogs(child, options.maxProtocolBytes, options.maxLogBytes);
	let terminationError: PythonRunnerError | undefined;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let cancellationHandler: (() => void) | undefined;
	let terminationPromise: Promise<void> | undefined;

	const terminate = (error: PythonRunnerError): Promise<void> => {
		if (!terminationError) terminationError = error;
		if (!terminationPromise) {
			terminationPromise = terminateProcessTree(child);
		}
		return terminationPromise;
	};

	try {
		if (options.timeoutSec > 0) {
			timeout = setTimeout(() => {
				void terminate(
					new PythonRunnerError(
						'timeout',
						`Code Pro Python execution timed out after ${options.timeoutSec}s. Python receives a hard process termination; JavaScript keeps its existing cooperative timeout behavior.`,
					),
				);
			}, options.timeoutSec * 1000);
		}
		cancellationHandler = () => {
			void terminate(
				new PythonRunnerError('cancelled', 'Code Pro Python execution was cancelled by n8n.'),
			);
		};
		if (options.cancelSignal?.aborted) cancellationHandler();
		else options.cancelSignal?.addEventListener('abort', cancellationHandler, { once: true });
		options.onExecutionCancellation?.(cancellationHandler);

		child.stdin?.end(input);
		const exit = await waitForExit(child);
		if (terminationPromise) await terminationPromise;
		const logs = collectLogs(collectors.protocol, collectors.stderr, collectors.log);
		if (terminationError) {
			terminationError.details.stdout = logs.stdout;
			terminationError.details.stderr = logs.stderr;
			terminationError.details.logsTruncated = logs.truncated;
			terminationError.details.exitCode = exit.code;
			terminationError.details.signal = exit.signal;
			throw terminationError;
		}
		if (collectors.protocol.wasTruncated) {
			throw new PythonRunnerError(
				'protocol',
				`Python protocol output exceeded the configured limit of ${options.maxProtocolBytes} bytes.`,
				runnerErrorDetails(logs, exit.code, exit.signal),
			);
		}
		if (exit.code !== 0) {
			throw new PythonRunnerError(
				'process_exit',
				`Python process exited with ${exit.signal ?? `code ${exit.code}`}.`,
				runnerErrorDetails(logs, exit.code, exit.signal),
			);
		}
		const response = parseResponse(collectors.protocol.text);
		if (!response.ok) throw protocolErrorToRunnerError(response.error, logs);
		if (options.mode === 'runOnceForEachItem') {
			if (!Array.isArray(response.results) || response.results.length !== options.items.length) {
				throw new PythonRunnerError(
					'protocol',
					'Python returned an invalid each-item result list.',
					runnerErrorDetails(logs),
				);
			}
			const results = response.results.map((entry): PythonItemResult => {
				if (!entry || typeof entry !== 'object' || !('ok' in entry)) {
					return { ok: false, error: new PythonRunnerError('protocol', 'Python returned an invalid item result.', runnerErrorDetails(logs)) };
				}
				const item = entry as ProtocolItemSuccess | ProtocolItemFailure;
				return item.ok
					? { ok: true, value: item.value }
					: { ok: false, error: protocolErrorToRunnerError(item.error, logs) };
			});
			return { mode: options.mode, results, logs, interpreter: resolution.interpreter };
		}
		return { mode: options.mode, result: response.result, logs, interpreter: resolution.interpreter };
	} catch (error) {
		if (terminationError && error !== terminationError) throw terminationError;
		throw error;
	} finally {
		if (timeout) clearTimeout(timeout);
		if (cancellationHandler) options.cancelSignal?.removeEventListener('abort', cancellationHandler);
		if (child.exitCode === null) await terminateProcessTree(child);
		child.stdin?.destroy();
		child.stdout?.destroy();
		child.stderr?.destroy();
		const logStream = child.stdio[3];
		if (logStream && 'destroy' in logStream) {
			(logStream as unknown as { destroy: () => void }).destroy();
		}
	}
}

export function logPythonOutput(ctx: IExecuteFunctions, logs: PythonLogOutput): void {
	const logger = ctx.logger as { info?: (message: string) => void; warn?: (message: string) => void };
	if (logs.stdout) logger.info?.(`[Code Pro Python] ${logs.stdout}`);
	if (logs.stderr) logger.warn?.(`[Code Pro Python] ${logs.stderr}`);
	if (logs.truncated) logger.warn?.('[Code Pro Python] Captured Python output was truncated at the configured log limit.');
}
