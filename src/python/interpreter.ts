/** Native Python discovery. Only successful interpreter probes are cached. */

import { spawn } from 'node:child_process';

export interface PythonCandidate {
	command: string;
	args: string[];
	display: string;
}

export interface PythonInterpreter extends PythonCandidate {
	version: string;
	major: number;
	minor: number;
}

export interface InterpreterResolution {
	interpreter: PythonInterpreter;
	checked: string[];
}

export interface InterpreterResolutionOptions {
	explicitExecutable?: string;
	environment?: NodeJS.ProcessEnv;
	platform?: NodeJS.Platform;
	probe?: (candidate: PythonCandidate) => Promise<PythonInterpreter | undefined>;
}

const discoveryCache = new Map<string, Promise<InterpreterResolution>>();

const PROBE_SCRIPT =
	"import json,sys; print(json.dumps({'version': '.'.join(map(str, sys.version_info[:3])), 'major': sys.version_info.major, 'minor': sys.version_info.minor}))";

export class PythonRuntimeUnavailableError extends Error {
	readonly errorType = 'python_unavailable';

	constructor(public readonly checked: string[]) {
		super(
			`Python is unavailable. Executables checked: ${checked.join(', ') || 'none'}. ` +
				'Code Pro requires native Python 3.11 or newer. Set Options > Python > Python Executable or CODE_PRO_PYTHON_PATH, then restart n8n. ' +
				'For Docker, install Python in the n8n/worker image. In queue mode, install Code Pro and Python on every worker that can execute this node.',
		);
		this.name = 'PythonRuntimeUnavailableError';
	}
}

function normalized(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function getPythonCandidates(options: InterpreterResolutionOptions = {}): PythonCandidate[] {
	const environment = options.environment ?? process.env;
	const platform = options.platform ?? process.platform;
	const candidates: PythonCandidate[] = [];
	const add = (command: string | undefined, args: string[], display: string) => {
		if (!command) return;
		if (candidates.some((candidate) => candidate.command === command && candidate.args.join('\u0000') === args.join('\u0000'))) {
			return;
		}
		candidates.push({ command, args, display });
	};

	add(normalized(options.explicitExecutable), [], 'Options > Python Executable');
	add(normalized(environment.CODE_PRO_PYTHON_PATH), [], 'CODE_PRO_PYTHON_PATH');
	add('python3', [], 'python3');
	add('python', [], 'python');
	if (platform === 'win32') add('py', ['-3'], 'py -3');
	return candidates;
}

function cacheKey(options: InterpreterResolutionOptions): string {
	return JSON.stringify({
		explicitExecutable: normalized(options.explicitExecutable),
		envExecutable: normalized((options.environment ?? process.env).CODE_PRO_PYTHON_PATH),
		platform: options.platform ?? process.platform,
	});
}

export function clearPythonInterpreterDiscoveryCache(): void {
	discoveryCache.clear();
}

export async function resolvePythonInterpreter(
	options: InterpreterResolutionOptions = {},
): Promise<InterpreterResolution> {
	const key = cacheKey(options);
	const cached = discoveryCache.get(key);
	if (cached) return await cached;

	const resolution = resolveUncached(options);
	discoveryCache.set(key, resolution);
	try {
		return await resolution;
	} catch (error) {
		discoveryCache.delete(key);
		throw error;
	}
}

async function resolveUncached(options: InterpreterResolutionOptions): Promise<InterpreterResolution> {
	const probe = options.probe ?? probePythonInterpreter;
	const checked: string[] = [];
	for (const candidate of getPythonCandidates(options)) {
		try {
			const interpreter = await probe(candidate);
			if (!interpreter) {
				checked.push(candidate.display);
				continue;
			}
			if (interpreter.major === 3 && interpreter.minor >= 11) {
				return { interpreter, checked: [...checked, `${candidate.display} (${interpreter.version})`] };
			}
			checked.push(`${candidate.display} (Python ${interpreter.version}; requires 3.11+)`);
		} catch {
			checked.push(candidate.display);
		}
	}
	throw new PythonRuntimeUnavailableError(checked);
}

export async function probePythonInterpreter(
	candidate: PythonCandidate,
): Promise<PythonInterpreter | undefined> {
	return await new Promise<PythonInterpreter | undefined>((resolve) => {
		const child = spawn(candidate.command, [...candidate.args, '-c', PROBE_SCRIPT], {
			shell: false,
			windowsHide: true,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let stdout = '';
		let settled = false;
		const finish = (value: PythonInterpreter | undefined) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve(value);
		};
		const timer = setTimeout(() => {
			try {
				child.kill('SIGKILL');
			} catch {
				// The process may already have exited.
			}
			finish(undefined);
		}, 5000);
		child.stdout.on('data', (chunk: Buffer) => {
			if (stdout.length < 2048) stdout += chunk.toString('utf8');
		});
		child.once('error', () => finish(undefined));
		child.once('exit', (code) => {
			if (code !== 0) return finish(undefined);
			try {
				const data = JSON.parse(stdout.trim()) as {
					version?: unknown;
					major?: unknown;
					minor?: unknown;
				};
				if (
					typeof data.version !== 'string' ||
					typeof data.major !== 'number' ||
					typeof data.minor !== 'number'
				) {
					return finish(undefined);
				}
				finish({ ...candidate, version: data.version, major: data.major, minor: data.minor });
			} catch {
				finish(undefined);
			}
		});
	});
}
