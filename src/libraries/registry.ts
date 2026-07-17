/**
 * Build and cache sandbox library globals (eager + lazy getters).
 *
 * Default is lazy load — first Code Pro run must not require() heavy trees
 * (web3/ccxt/ffmpeg/jimp/…) unless user code touches those globals.
 */

import { createUtilsBag } from '../utils/utilsBag';
import { LIBRARY_ENTRIES } from './entries';
import { createMissingStub, isMissingLibrary } from './moduleInterop';
import { loadEntry } from './loadEntry';
import type { LoadLibrariesResult } from './types';

/**
 * Build sandbox globals. Eager entries load immediately; lazy entries use getters.
 * Default is lazy (lazy !== false).
 */
export function loadLibraryGlobals(): LoadLibrariesResult {
	const globals: Record<string, unknown> = {};
	const cache = new Map<string, unknown>();
	const failed: LoadLibrariesResult['failed'] = [];
	const failedInjects = new Set<string>();

	const registeredNames = [
		...new Set(LIBRARY_ENTRIES.flatMap((e) => e.injects).concat(['utils'])),
	].sort();

	const markFailed = (inject: string, packageName: string, error: string) => {
		failedInjects.add(inject);
		if (!failed.some((f) => f.inject === inject && f.packageName === packageName)) {
			failed.push({ inject, packageName, error });
		}
	};

	const computeAvailable = (): string[] => {
		const names: string[] = [];
		for (const name of registeredNames) {
			if (name === 'utils') {
				names.push(name);
				continue;
			}
			if (failedInjects.has(name)) continue;
			if (cache.has(name) && isMissingLibrary(cache.get(name))) continue;
			const desc = Object.getOwnPropertyDescriptor(globals, name);
			if (desc && 'value' in desc && isMissingLibrary(desc.value)) continue;
			names.push(name);
		}
		return names.sort();
	};

	for (const entry of LIBRARY_ENTRIES) {
		// Default lazy unless explicitly lazy: false
		const isLazy = entry.lazy !== false;

		if (!isLazy) {
			const { values, error } = loadEntry(entry);
			if (error) {
				for (const name of entry.injects) {
					const stub = createMissingStub(name, entry.packageName);
					globals[name] = stub;
					cache.set(name, stub);
					markFailed(name, entry.packageName, error);
				}
				continue;
			}
			for (const [name, value] of Object.entries(values)) {
				if (value !== undefined && !isMissingLibrary(value)) {
					globals[name] = value;
					cache.set(name, value);
				} else {
					const stub = createMissingStub(name, entry.packageName);
					globals[name] = stub;
					cache.set(name, stub);
					markFailed(name, entry.packageName, 'resolved to undefined');
				}
			}
			continue;
		}

		// Lazy: define getters — do not object-spread later (would eager-load)
		for (const injectName of entry.injects) {
			Object.defineProperty(globals, injectName, {
				enumerable: true,
				configurable: true,
				get() {
					if (cache.has(injectName)) {
						return cache.get(injectName);
					}
					const { values, error } = loadEntry(entry);
					if (error) {
						const stub = createMissingStub(injectName, entry.packageName);
						cache.set(injectName, stub);
						markFailed(injectName, entry.packageName, error);
						// Materialize stub so subsequent access is data property
						Object.defineProperty(globals, injectName, {
							enumerable: true,
							configurable: true,
							writable: true,
							value: stub,
						});
						return stub;
					}
					for (const [name, value] of Object.entries(values)) {
						const v =
							value !== undefined ? value : createMissingStub(name, entry.packageName);
						if (value === undefined) {
							markFailed(name, entry.packageName, 'resolved to undefined');
						}
						cache.set(name, v);
						Object.defineProperty(globals, name, {
							enumerable: true,
							configurable: true,
							writable: true,
							value: v,
						});
					}
					return cache.get(injectName);
				},
			});
		}
	}

	globals.utils = createUtilsBag({
		getAvailableLibraries: computeAvailable,
		getRegisteredLibraries: () => registeredNames,
		getFailedLibraries: () => [...failed],
		// Prefer the same axios inject users already have in the sandbox
		getAxios: () => {
			const ax = globals.axios as { get?: unknown } | undefined;
			if (ax && typeof ax.get === 'function') {
				return ax as import('../utils/sitemap/types').AxiosLike;
			}
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mod = require('axios') as { default?: { get: unknown } } & { get: unknown };
			const resolved = (mod && typeof (mod as { default?: unknown }).default === 'function'
				? (mod as { default: { get: unknown } }).default
				: mod) as import('../utils/sitemap/types').AxiosLike;
			return resolved;
		},
	});

	return {
		globals,
		loaded: registeredNames,
		failed,
		availableList: computeAvailable(),
	};
}

let cached: LoadLibrariesResult | undefined;

export function getLibraryGlobals(): LoadLibrariesResult {
	if (!cached) {
		cached = loadLibraryGlobals();
	}
	return cached;
}

export function clearLibraryCache(): void {
	cached = undefined;
}
