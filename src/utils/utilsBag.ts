/**
 * First-party `utils` global for Code Pro (sleep, retry, sitemap, inventory helpers).
 */

import { getCodeProVersion } from './version';
import { mapPool } from './mapPool';
import type { AxiosLike } from './sitemap/types';

export interface RetryOptions {
	attempts?: number;
	delay?: number;
}

export interface UtilsBagOptions {
	/** Libraries expected to work (registered minus known failures / stubs). */
	getAvailableLibraries: () => string[];
	/** Every inject name declared in the registry (including not-yet-touched lazy). */
	getRegisteredLibraries: () => string[];
	/** Libraries that failed to load (if tracked). */
	getFailedLibraries?: () => Array<{ inject: string; packageName: string; error: string }>;
	/**
	 * Resolve axios for utils.sitemap / network helpers.
	 * Prefer the same instance as the sandbox `axios` inject.
	 */
	getAxios?: () => AxiosLike;
}

function defaultGetAxios(): AxiosLike {
	// Lazy require so cold paths without sitemap don't pay unless used
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const mod = require('axios') as { default?: AxiosLike } & AxiosLike;
	const ax = (mod && typeof (mod as { default?: AxiosLike }).default === 'function'
		? (mod as { default: AxiosLike }).default
		: mod) as AxiosLike;
	return ax;
}

export function createUtilsBag(options: UtilsBagOptions): Record<string, unknown> {
	const {
		getAvailableLibraries,
		getRegisteredLibraries,
		getFailedLibraries = () => [],
		getAxios = defaultGetAxios,
	} = options;

	// Lazy: don't pull sitemap/http/parse (and their deps) until utils.sitemap is used
	let sitemapHelpers: Record<string, unknown> | undefined;
	const getSitemap = () => {
		if (!sitemapHelpers) {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const { createSitemapHelpers } = require('./sitemap') as {
				createSitemapHelpers: (deps: { getAxios: () => AxiosLike }) => Record<string, unknown>;
			};
			sitemapHelpers = createSitemapHelpers({ getAxios });
		}
		return sitemapHelpers;
	};

	const bag: Record<string, unknown> = {
		/** Package version of the loaded Code Pro build (for live n8n L1 checks). */
		getCodeProVersion,

		sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

		retry: async <T>(fn: () => Promise<T> | T, options: RetryOptions = {}): Promise<T> => {
			const attempts = options.attempts ?? 3;
			const delay = options.delay ?? 1000;
			let lastError: unknown;
			for (let i = 0; i < attempts; i++) {
				try {
					return await fn();
				} catch (error) {
					lastError = error;
					if (i < attempts - 1) {
						await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
					}
				}
			}
			throw lastError;
		},

		/**
		 * Run async work over items with bounded concurrency (order-preserving).
		 * Useful for multi-site HTTP batches outside sitemap helpers.
		 */
		mapPool,


		flatten: function flatten(
			obj: Record<string, unknown>,
			prefix = '',
		): Record<string, unknown> {
			const flattened: Record<string, unknown> = {};
			for (const key of Object.keys(obj ?? {})) {
				const newKey = prefix ? `${prefix}.${key}` : key;
				const value = obj[key];
				if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
					Object.assign(flattened, flatten(value as Record<string, unknown>, newKey));
				} else {
					flattened[newKey] = value;
				}
			}
			return flattened;
		},

		isEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '')),

		isUrl: (url: string) => {
			try {
				// eslint-disable-next-line no-new
				new URL(url);
				return true;
			} catch {
				return false;
			}
		},

		sanitizeInput: (input: string) =>
			String(input ?? '')
				.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
				.replace(/javascript:/gi, '')
				.replace(/on\w+\s*=/gi, '')
				.trim(),

		/**
		 * Libraries that should work: registered injects minus known load failures / stubs.
		 * Lazy libs count as available until a failed load is observed.
		 */
		getAvailableLibraries,

		/** All inject names declared in the registry (includes lazy not yet touched). */
		getRegisteredLibraries,

		/** Injects that failed to resolve (package missing / ESM / binary / etc.). */
		getFailedLibraries,

		/** True if global is present and not a missing-library stub. */
		isLibraryAvailable: (name: string) => {
			const available = getAvailableLibraries();
			return available.includes(name);
		},

		memoryUsage: () => {
			const usage = process.memoryUsage();
			return {
				heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
				heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
				external: `${Math.round(usage.external / 1024 / 1024)} MB`,
				rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
			};
		},
	};

	Object.defineProperty(bag, 'sitemap', {
		enumerable: true,
		configurable: true,
		get: getSitemap,
	});

	return bag;
}
