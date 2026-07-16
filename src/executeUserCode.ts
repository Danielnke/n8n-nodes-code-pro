import { createContext, runInContext, type Context } from 'node:vm';
import type { IExecuteFunctions, INodeExecutionData, IDataObject } from 'n8n-workflow';

import {
	getAllowedRequirePackages,
	getLibraryGlobals,
	REQUIRE_ALIASES,
} from './libraryRegistry';

export type CodeProMode = 'runOnceForAllItems' | 'runOnceForEachItem';

export interface RunUserCodeOptions {
	code: string;
	/** Items passed into this invocation (each-item: usually [current]). */
	items: INodeExecutionData[];
	/** Full workflow input for this node (stock $input.all()). */
	allItems?: INodeExecutionData[];
	itemIndex: number;
	mode: CodeProMode;
	timeoutSec: number;
	ctx: IExecuteFunctions;
	extraGlobals?: Record<string, unknown>;
	loadLibraries?: boolean;
}

/**
 * Stock Code semantics:
 * - all-items: $input.all() = full list
 * - each-item: $input.item / $json = current; $input.all() still = FULL list
 */
function buildInputHelpers(
	allItems: INodeExecutionData[],
	currentItem: INodeExecutionData | undefined,
	mode: CodeProMode,
) {
	if (mode === 'runOnceForEachItem') {
		return {
			all: () => allItems,
			first: () => allItems[0],
			last: () => allItems[allItems.length - 1],
			item: currentItem,
			json: currentItem?.json,
		};
	}

	return {
		all: () => allItems,
		first: () => allItems[0],
		last: () => allItems[allItems.length - 1],
		json: allItems.length === 1 ? allItems[0]?.json : allItems.map((i) => i.json),
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

			const logger = (
				ctx as unknown as {
					logger?: {
						info: (m: string) => void;
						warn: (m: string) => void;
						error: (m: string) => void;
					};
				}
			).logger;
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

export function buildSandbox(options: RunUserCodeOptions): Context {
	const {
		items,
		allItems: allItemsOpt,
		itemIndex,
		mode,
		ctx,
		extraGlobals = {},
		loadLibraries = true,
	} = options;

	const allItems = allItemsOpt ?? items;
	const currentItem =
		mode === 'runOnceForEachItem' ? (items[0] ?? allItems[itemIndex]) : undefined;

	let dataProxy: Record<string, unknown> = {};
	try {
		dataProxy = ctx.getWorkflowDataProxy(itemIndex) as unknown as Record<string, unknown>;
	} catch {
		dataProxy = {};
	}

	// Start from stock proxy $input if present, then overlay corrected all/item
	const stockInput = dataProxy.$input as Record<string, unknown> | undefined;
	const overlay = buildInputHelpers(allItems, currentItem, mode);
	const $input = {
		...(stockInput && typeof stockInput === 'object' ? stockInput : {}),
		...overlay,
	};

	const libraryGlobals = loadLibraries ? getLibraryGlobals().globals : {};

	const allowedPackages = new Set(loadLibraries ? getAllowedRequirePackages() : []);

	const restrictedRequire = (name: string): unknown => {
		const resolved = REQUIRE_ALIASES[name] ?? name;
		if (!allowedPackages.has(resolved) && !allowedPackages.has(name)) {
			throw new Error(
				`require('${name}') is not allowed in Code Pro. Use injected globals or a registered package (see README library list).`,
			);
		}
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		return require(resolved);
	};

	const sandbox: Record<string, unknown> = {
		...dataProxy,
		// Mode aliases (stock Code)
		items: mode === 'runOnceForAllItems' ? allItems : undefined,
		item: currentItem,
		$itemIndex: itemIndex,
		$input,
		$json:
			mode === 'runOnceForEachItem'
				? currentItem?.json
				: (dataProxy.$json as IDataObject | undefined) ?? allItems[0]?.json,
		$binary:
			mode === 'runOnceForEachItem' ? currentItem?.binary : dataProxy.$binary,
		helpers: ctx.helpers,
		$getWorkflowStaticData: ctx.getWorkflowStaticData?.bind(ctx),
		$getNodeParameter: ctx.getNodeParameter.bind(ctx),
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
		// Web-ish helpers available on Node 20 host (not always in bare vm)
		...(typeof fetch === 'function' ? { fetch } : {}),
		...(typeof AbortController === 'function' ? { AbortController } : {}),
		...(typeof TextEncoder === 'function' ? { TextEncoder, TextDecoder } : {}),
		...extraGlobals,
		require: restrictedRequire,
	};

	// Preserve lazy getters — do NOT object-spread libraryGlobals (that would eager-load)
	if (loadLibraries) {
		for (const key of Object.keys(libraryGlobals)) {
			const desc = Object.getOwnPropertyDescriptor(libraryGlobals, key);
			if (desc) {
				Object.defineProperty(sandbox, key, desc);
			}
		}
	}

	return createContext(sandbox);
}

export function createVmExecutableCode(code: string): string {
	return [
		'globalThis.global = globalThis',
		'var module = { exports: {} }',
		`module.exports = async function CodeProVmWrapper() {${code}\n}()`,
	].join('; ');
}

/**
 * Execute user JavaScript.
 * Applies wall-clock timeout to the full async run (not just sync VM eval).
 */
export async function runUserCode(options: RunUserCodeOptions): Promise<unknown> {
	const { code, timeoutSec } = options;
	const context = buildSandbox(options);
	const executable = createVmExecutableCode(code);
	const timeoutMs = Math.max(1, timeoutSec) * 1000;

	let timer: ReturnType<typeof setTimeout> | undefined;

	const timeoutPromise = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			reject(
				new Error(
					`Code Pro execution timed out after ${timeoutSec}s. Reduce work, avoid hanging HTTP, or increase Options → Timeout.`,
				),
			);
		}, timeoutMs);
		// Don't keep process alive solely for this timer
		if (typeof timer === 'object' && timer && 'unref' in timer) {
			(timer as NodeJS.Timeout).unref();
		}
	});

	try {
		// VM timeout still helps for tight sync loops; Promise.race covers await work
		const vmResult = runInContext(executable, context, {
			timeout: timeoutMs,
			displayErrors: true,
		}) as unknown;

		const result = await Promise.race([Promise.resolve(vmResult), timeoutPromise]);
		return result;
	} catch (error) {
		const err = error as Error & { code?: string };
		if (
			err.message?.includes('Script execution timed out') ||
			err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT'
		) {
			throw new Error(
				`Code Pro execution timed out after ${timeoutSec}s. Reduce work or increase the Timeout parameter.`,
			);
		}
		throw error;
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
