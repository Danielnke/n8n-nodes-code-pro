import { createContext, runInContext, type Context } from 'node:vm';
import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';

export type CodeProMode = 'runOnceForAllItems' | 'runOnceForEachItem';

export interface RunUserCodeOptions {
	code: string;
	items: INodeExecutionData[];
	itemIndex: number;
	mode: CodeProMode;
	timeoutSec: number;
	ctx: IExecuteFunctions;
	/** Extra globals (libraries in later phases). */
	extraGlobals?: Record<string, unknown>;
}

function buildInputHelpers(items: INodeExecutionData[], mode: CodeProMode, itemIndex: number) {
	if (mode === 'runOnceForEachItem') {
		const current = items[0];
		return {
			all: () => items,
			first: () => current,
			last: () => current,
			item: current,
			json: current?.json,
		};
	}

	return {
		all: () => items,
		first: () => items[0],
		last: () => items[items.length - 1],
		json: items.length === 1 ? items[0]?.json : items.map((i) => i.json),
	};
}

function createConsole(ctx: IExecuteFunctions) {
	const forward =
		(level: 'log' | 'warn' | 'error') =>
		(...args: unknown[]) => {
			const message = args
				.map((a) => {
					if (typeof a === 'string') return a;
					try {
						return JSON.stringify(a);
					} catch {
						return String(a);
					}
				})
				.join(' ');

			// Best-effort: n8n logger if present, else process console
			const logger = (ctx as unknown as { logger?: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void } })
				.logger;
			if (logger) {
				if (level === 'error') logger.error(`[Code Pro] ${message}`);
				else if (level === 'warn') logger.warn(`[Code Pro] ${message}`);
				else logger.info(`[Code Pro] ${message}`);
			} else if (level === 'error') {
				console.error('[Code Pro]', ...args);
			} else if (level === 'warn') {
				console.warn('[Code Pro]', ...args);
			} else {
				console.log('[Code Pro]', ...args);
			}
		};

	return {
		log: forward('log'),
		warn: forward('warn'),
		error: forward('error'),
		info: forward('log'),
		debug: forward('log'),
	};
}

/**
 * Build the VM context: stock-like helpers from getWorkflowDataProxy + mode overlays.
 */
export function buildSandbox(options: RunUserCodeOptions): Context {
	const { items, itemIndex, mode, ctx, extraGlobals = {} } = options;

	let dataProxy: Record<string, unknown> = {};
	try {
		dataProxy = ctx.getWorkflowDataProxy(itemIndex) as unknown as Record<string, unknown>;
	} catch {
		// Proxy can throw if execution data incomplete; fall back to minimal helpers
		dataProxy = {};
	}

	const $input = buildInputHelpers(items, mode, itemIndex);
	const currentItem = mode === 'runOnceForEachItem' ? items[0] : undefined;

	const sandbox: Record<string, unknown> = {
		...dataProxy,
		// Mode aliases (stock Code)
		items: mode === 'runOnceForAllItems' ? items : undefined,
		item: currentItem,
		$itemIndex: itemIndex,
		// Prefer our $input overlay for predictable all/each semantics
		$input,
		$json: mode === 'runOnceForEachItem' ? currentItem?.json : (dataProxy.$json as IDataObject | undefined),
		$binary: mode === 'runOnceForEachItem' ? currentItem?.binary : dataProxy.$binary,
		// n8n helpers when available
		helpers: ctx.helpers,
		$getWorkflowStaticData: ctx.getWorkflowStaticData?.bind(ctx),
		$getNodeParameter: ctx.getNodeParameter.bind(ctx),
		// Console + natives
		console: createConsole(ctx),
		Buffer,
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		setImmediate,
		clearImmediate,
		URL,
		URLSearchParams,
		// Phase 3+: library globals
		...extraGlobals,
	};

	return createContext(sandbox);
}

/**
 * Stock-style async wrapper so user code can use return + top-level await.
 */
export function createVmExecutableCode(code: string): string {
	return [
		'globalThis.global = globalThis',
		'var module = { exports: {} }',
		`module.exports = async function CodeProVmWrapper() {${code}\n}()`,
	].join('; ');
}

/**
 * Execute user JavaScript and return the raw result (before validation).
 */
export async function runUserCode(options: RunUserCodeOptions): Promise<unknown> {
	const { code, timeoutSec } = options;
	const context = buildSandbox(options);
	const executable = createVmExecutableCode(code);
	const timeoutMs = Math.max(1, timeoutSec) * 1000;

	try {
		const result = (await runInContext(executable, context, {
			timeout: timeoutMs,
			displayErrors: true,
		})) as unknown;
		return result;
	} catch (error) {
		const err = error as Error & { code?: string };
		if (err.message?.includes('Script execution timed out') || err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
			throw new Error(
				`Code Pro execution timed out after ${timeoutSec}s. Reduce work or increase the Timeout parameter.`,
			);
		}
		throw error;
	}
}
