/**
 * Assemble the VM sandbox: stock helpers + libraries + host builtins.
 */

import { createContext, type Context } from 'node:vm';
import type { IDataObject } from 'n8n-workflow';

import { getLibraryGlobals } from '../libraries';
import { createConsole } from './consoleBridge';
import { installLibraryGlobalsOnSandbox } from './installLibrariesOnSandbox';
import { buildInputHelpers } from './inputHelpers';
import { createRestrictedRequire } from './restrictedRequire';
import type { TrackedTimerController } from './trackedTimers';
import type { RunUserCodeOptions } from './types';

export function buildSandbox(
	options: RunUserCodeOptions,
	timers?: TrackedTimerController['globals'],
): Context {
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
	} catch (error) {
		const logger = (
			ctx as unknown as { logger?: { warn: (m: string) => void } }
		).logger;
		const message = error instanceof Error ? error.message : String(error);
		logger?.warn?.(
			`[Code Pro] getWorkflowDataProxy failed at item ${itemIndex}: ${message}. Stock $ helpers may be incomplete.`,
		);
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
		setTimeout: timers?.setTimeout ?? setTimeout,
		clearTimeout: timers?.clearTimeout ?? clearTimeout,
		setInterval: timers?.setInterval ?? setInterval,
		clearInterval: timers?.clearInterval ?? clearInterval,
		setImmediate: timers?.setImmediate ?? setImmediate,
		clearImmediate: timers?.clearImmediate ?? clearImmediate,
		URL,
		URLSearchParams,
		// Host builtins (outer realm) for instanceof / missing-global safety
		Promise,
		JSON,
		Math,
		Date,
		Object,
		Array,
		String,
		Number,
		Boolean,
		RegExp,
		Error,
		Map,
		Set,
		WeakMap,
		WeakSet,
		Symbol,
		Proxy,
		Reflect,
		// Web-ish helpers available on Node 20 host (not always in bare vm)
		...(typeof fetch === 'function' ? { fetch } : {}),
		...(typeof AbortController === 'function' ? { AbortController } : {}),
		...(typeof TextEncoder === 'function' ? { TextEncoder, TextDecoder } : {}),
		...extraGlobals,
	};

	// A-lite materialize: eager values as plain data props; lazy getters re-bind onto *sandbox*
	if (loadLibraries) {
		installLibraryGlobalsOnSandbox(sandbox, libraryGlobals);
	}

	const isolatedRequireInjects: Record<string, string> = {
		axios: 'axios',
		lodash: 'lodash',
		handlebars: 'Handlebars',
	};
	sandbox.require = createRestrictedRequire(loadLibraries, (packageName) => {
		const inject = isolatedRequireInjects[packageName];
		return inject
			? { found: true, value: sandbox[inject] }
			: { found: false };
	});

	return createContext(sandbox);
}
