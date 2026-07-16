/**
 * Canonical library inject map for Code Pro.
 * SuperCode-parity names + Code Pro extras.
 *
 * Heavy/optional packages use lazy getters so first Code Pro run does not
 * require() web3/ccxt/ffmpeg unless the user actually touches those globals.
 */

import { createUtilsBag } from './utilsBag';

export interface LibraryEntry {
	/** Inject global name(s) */
	injects: string[];
	/** npm package name */
	packageName: string;
	/**
	 * Lazy-load on first access (default true for optional; set false to eager-load core).
	 */
	lazy?: boolean;
	/** Prefer stub over throw when package missing (still tries load). */
	optional?: boolean;
	/** Map required module → injected value(s). Default: module itself for each inject. */
	resolve?: (mod: unknown) => Record<string, unknown>;
}

function req(packageName: string): unknown {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	return require(packageName);
}

function defaultExport(mod: unknown): unknown {
	if (mod && typeof mod === 'object' && 'default' in (mod as object)) {
		const d = (mod as { default: unknown }).default;
		if (d !== undefined) return d;
	}
	return mod;
}

/**
 * SuperCode-parity + extras.
 * Core automation libs: eager. Heavy blockchain/media: lazy.
 */
export const LIBRARY_ENTRIES: LibraryEntry[] = [
	// --- Data / utils (eager) ---
	{
		injects: ['_', 'lodash'],
		packageName: 'lodash',
		lazy: false,
		resolve: (mod) => {
			const _ = defaultExport(mod);
			return { _: _, lodash: _ };
		},
	},
	{ injects: ['bytes'], packageName: 'bytes', lazy: false },
	{ injects: ['ms'], packageName: 'ms', lazy: false },
	{ injects: ['qs'], packageName: 'qs', lazy: false },
	{
		injects: ['uuid'],
		packageName: 'uuid',
		lazy: false,
		resolve: (mod) => ({ uuid: mod }),
	},
	{
		// Full module surface: nanoid(), customAlphabet, …
		injects: ['nanoid'],
		packageName: 'nanoid',
		lazy: false,
		resolve: (mod) => {
			const m = mod as Record<string, unknown> | ((...a: unknown[]) => unknown);
			if (typeof m === 'function') {
				return { nanoid: m };
			}
			// CJS export { nanoid, customAlphabet, ... } — inject whole module
			// Also support calling nanoid() if only .nanoid exists
			const fn = m.nanoid;
			if (typeof fn === 'function') {
				const callable = Object.assign(fn.bind(m), m);
				return { nanoid: callable };
			}
			return { nanoid: m };
		},
	},

	// --- Dates ---
	{ injects: ['dayjs'], packageName: 'dayjs', lazy: false },
	{
		injects: ['moment'],
		packageName: 'moment-timezone',
		lazy: false,
		resolve: (mod) => ({ moment: defaultExport(mod) }),
	},
	{
		injects: ['dateFns'],
		packageName: 'date-fns',
		lazy: false,
		resolve: (mod) => ({ dateFns: mod }),
	},
	{
		injects: ['dateFnsTz'],
		packageName: 'date-fns-tz',
		lazy: false,
		resolve: (mod) => ({ dateFnsTz: mod }),
	},
	{
		injects: ['luxon', 'DateTime'],
		packageName: 'luxon',
		lazy: false,
		resolve: (mod) => {
			const m = mod as { DateTime: unknown };
			return { luxon: m, DateTime: m.DateTime };
		},
	},
	{
		injects: ['cronParser'],
		packageName: 'cron-parser',
		lazy: false,
		resolve: (mod) => ({ cronParser: defaultExport(mod) ?? mod }),
	},

	// --- Validation ---
	{
		injects: ['joi', 'Joi'],
		packageName: 'joi',
		lazy: false,
		resolve: (mod) => {
			const j = defaultExport(mod);
			return { joi: j, Joi: j };
		},
	},
	{ injects: ['validator'], packageName: 'validator', lazy: false },
	{
		injects: ['Ajv'],
		packageName: 'ajv',
		lazy: false,
		resolve: (mod) => ({ Ajv: defaultExport(mod) }),
	},
	{ injects: ['yup'], packageName: 'yup', lazy: false, optional: true },
	{
		injects: ['z', 'zod'],
		packageName: 'zod',
		lazy: false,
		resolve: (mod) => {
			const z = defaultExport(mod);
			return { z, zod: z };
		},
	},
	{
		injects: ['phoneNumber'],
		packageName: 'libphonenumber-js',
		lazy: false,
		resolve: (mod) => ({ phoneNumber: mod }),
	},
	{ injects: ['iban'], packageName: 'iban', lazy: false },

	// --- Parse / formats ---
	{ injects: ['xml2js'], packageName: 'xml2js', lazy: false },
	{
		injects: ['XMLParser', 'XMLBuilder'],
		packageName: 'fast-xml-parser',
		lazy: false,
		resolve: (mod) => {
			const m = mod as { XMLParser: unknown; XMLBuilder: unknown };
			return { XMLParser: m.XMLParser, XMLBuilder: m.XMLBuilder };
		},
	},
	{
		injects: ['YAML'],
		packageName: 'yaml',
		lazy: false,
		resolve: (mod) => ({ YAML: mod }),
	},
	{
		injects: ['papaparse', 'Papa'],
		packageName: 'papaparse',
		lazy: false,
		resolve: (mod) => {
			const p = defaultExport(mod);
			return { papaparse: p, Papa: p };
		},
	},
	{ injects: ['ini'], packageName: 'ini', lazy: false },
	{ injects: ['toml'], packageName: 'toml', lazy: false },
	{ injects: ['jmespath'], packageName: 'jmespath', lazy: false },
	{
		injects: ['jsonDiff'],
		packageName: 'json-diff-ts',
		lazy: false,
		resolve: (mod) => ({ jsonDiff: mod }),
	},

	// --- HTML / text ---
	{ injects: ['cheerio'], packageName: 'cheerio', lazy: false, optional: true },
	{
		injects: ['Handlebars'],
		packageName: 'handlebars',
		lazy: false,
		resolve: (mod) => ({ Handlebars: defaultExport(mod) }),
	},
	{
		// SuperCode expects callable htmlToText(html), not { convert }
		injects: ['htmlToText'],
		packageName: 'html-to-text',
		lazy: false,
		resolve: (mod) => {
			const m = mod as { htmlToText?: unknown; convert?: unknown };
			const fn = m.htmlToText ?? m.convert ?? defaultExport(mod) ?? mod;
			return { htmlToText: fn };
		},
	},
	{
		injects: ['marked'],
		packageName: 'marked',
		lazy: false,
		optional: true,
		resolve: (mod) => ({ marked: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['slug'],
		packageName: 'slug',
		lazy: false,
		optional: true,
		resolve: (mod) => ({ slug: defaultExport(mod) }),
	},
	{ injects: ['pluralize'], packageName: 'pluralize', lazy: false },
	{
		injects: ['fuzzy'],
		packageName: 'fuse.js',
		lazy: false,
		resolve: (mod) => ({ fuzzy: defaultExport(mod) }),
	},
	{
		injects: ['stringSimilarity'],
		packageName: 'string-similarity',
		lazy: false,
		resolve: (mod) => ({ stringSimilarity: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['franc'],
		packageName: 'franc-min',
		lazy: false,
		optional: true,
		resolve: (mod) => {
			// ESM namespace: { franc, francAll } — not a default function export
			const m = mod as { franc?: unknown; default?: unknown };
			const fn = m.franc ?? defaultExport(mod) ?? mod;
			return { franc: fn };
		},
	},
	{
		injects: ['compromise'],
		packageName: 'compromise',
		lazy: false,
		optional: true,
		resolve: (mod) => ({ compromise: defaultExport(mod) }),
	},

	// --- Crypto ---
	{
		injects: ['CryptoJS'],
		packageName: 'crypto-js',
		lazy: false,
		resolve: (mod) => ({ CryptoJS: defaultExport(mod) }),
	},
	{
		injects: ['forge'],
		packageName: 'node-forge',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ forge: defaultExport(mod) }),
	},
	{
		injects: ['jwt'],
		packageName: 'jsonwebtoken',
		lazy: false,
		resolve: (mod) => ({ jwt: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['bcrypt', 'bcryptjs'],
		packageName: 'bcryptjs',
		lazy: false,
		optional: true,
		resolve: (mod) => {
			const b = defaultExport(mod);
			return { bcrypt: b, bcryptjs: b };
		},
	},
	{
		injects: ['nodeCrypto'],
		packageName: 'crypto',
		lazy: false,
		resolve: (mod) => ({ nodeCrypto: mod }),
	},
	{
		injects: ['secp256k1'],
		packageName: '@noble/secp256k1',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ secp256k1: mod }),
	},
	{
		injects: ['bip39'],
		packageName: '@scure/bip39',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ bip39: mod }),
	},

	// --- Network ---
	{
		injects: ['axios'],
		packageName: 'axios',
		lazy: false,
		resolve: (mod) => ({ axios: defaultExport(mod) }),
	},
	{
		injects: ['FormData'],
		packageName: 'form-data',
		lazy: false,
		resolve: (mod) => ({ FormData: defaultExport(mod) }),
	},
	{
		injects: ['pRetry'],
		packageName: 'p-retry',
		lazy: false,
		optional: true,
		resolve: (mod) => ({ pRetry: defaultExport(mod) }),
	},

	// --- Files ---
	{
		injects: ['XLSX', 'xlsx'],
		packageName: 'xlsx',
		lazy: true,
		optional: true,
		resolve: (mod) => {
			const x = defaultExport(mod) ?? mod;
			return { XLSX: x, xlsx: x };
		},
	},
	{
		injects: ['ExcelJS'],
		packageName: 'exceljs',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ ExcelJS: defaultExport(mod) }),
	},
	{
		injects: ['JSZip'],
		packageName: 'jszip',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ JSZip: defaultExport(mod) }),
	},
	{
		injects: ['pako'],
		packageName: 'pako',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ pako: defaultExport(mod) }),
	},
	{
		injects: ['QRCode'],
		packageName: 'qrcode',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ QRCode: defaultExport(mod) ?? mod }),
	},

	// --- Heavy blockchain / media (always lazy) ---
	{
		injects: ['web3'],
		packageName: 'web3',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ web3: defaultExport(mod) }),
	},
	{
		injects: ['ccxt'],
		packageName: 'ccxt',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ ccxt: defaultExport(mod) }),
	},
	{
		injects: ['coinGecko'],
		packageName: 'coingecko-api-v3',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ coinGecko: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['solana'],
		packageName: '@solana/web3.js',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ solana: mod }),
	},
	{
		injects: ['bitcoin'],
		packageName: 'bitcoinjs-lib',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ bitcoin: mod }),
	},
	{
		injects: ['ytdl'],
		packageName: '@distube/ytdl-core',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ ytdl: defaultExport(mod) }),
	},
	{
		injects: ['ffmpeg'],
		packageName: 'fluent-ffmpeg',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ ffmpeg: defaultExport(mod) }),
	},
	{
		injects: ['ffmpegStatic'],
		packageName: 'ffmpeg-static',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ ffmpegStatic: defaultExport(mod) ?? mod }),
	},
];

function createMissingStub(injectName: string, packageName: string): unknown {
	const handler: ProxyHandler<object> = {
		get(_t, prop) {
			if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'valueOf') {
				return () => `[missing library ${injectName}]`;
			}
			throw new Error(
				`Code Pro library '${injectName}' is not available (failed to load npm package '${packageName}'). Check install or ESM compatibility.`,
			);
		},
		apply() {
			throw new Error(
				`Code Pro library '${injectName}' is not available (failed to load npm package '${packageName}').`,
			);
		},
	};
	const fn = () => {
		throw new Error(
			`Code Pro library '${injectName}' is not available (failed to load npm package '${packageName}').`,
		);
	};
	return new Proxy(fn, handler);
}

function loadEntry(entry: LibraryEntry): {
	values: Record<string, unknown>;
	error?: string;
} {
	try {
		const mod = req(entry.packageName);
		const resolved = entry.resolve
			? entry.resolve(mod)
			: Object.fromEntries(entry.injects.map((name) => [name, defaultExport(mod)]));
		return { values: resolved };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { values: {}, error: message };
	}
}

export interface LoadLibrariesResult {
	globals: Record<string, unknown>;
	/** Names that resolved at least once (eager) or are registered (lazy until touch). */
	loaded: string[];
	failed: Array<{ inject: string; packageName: string; error: string }>;
	availableList: string[];
}

/**
 * Build sandbox globals. Eager entries load immediately; lazy entries use getters.
 */
export function loadLibraryGlobals(): LoadLibrariesResult {
	const globals: Record<string, unknown> = {};
	const loaded: string[] = [];
	const failed: LoadLibrariesResult['failed'] = [];
	const cache = new Map<string, unknown>();

	for (const entry of LIBRARY_ENTRIES) {
		const isLazy = entry.lazy !== false && (entry.lazy === true || entry.optional === true);

		if (!isLazy) {
			const { values, error } = loadEntry(entry);
			if (error) {
				for (const name of entry.injects) {
					globals[name] = createMissingStub(name, entry.packageName);
					failed.push({ inject: name, packageName: entry.packageName, error });
				}
				continue;
			}
			for (const [name, value] of Object.entries(values)) {
				if (value !== undefined) {
					globals[name] = value;
					loaded.push(name);
					cache.set(name, value);
				} else {
					globals[name] = createMissingStub(name, entry.packageName);
					failed.push({
						inject: name,
						packageName: entry.packageName,
						error: 'resolved to undefined',
					});
				}
			}
			continue;
		}

		// Lazy: define getters on a holder object we merge via defineProperty on globals bag
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
						failed.push({ inject: injectName, packageName: entry.packageName, error });
						return stub;
					}
					for (const [name, value] of Object.entries(values)) {
						const v = value ?? createMissingStub(name, entry.packageName);
						cache.set(name, v);
						// Materialize sibling injects from same entry
						Object.defineProperty(globals, name, {
							enumerable: true,
							configurable: true,
							writable: true,
							value: v,
						});
						if (!loaded.includes(name) && value !== undefined) {
							loaded.push(name);
						}
					}
					return cache.get(injectName);
				},
			});
			// Count as available for SuperCode checklist (registered)
			if (!loaded.includes(injectName)) {
				loaded.push(injectName);
			}
		}
	}

	const availableList = [...new Set(loaded)].sort();
	globals.utils = createUtilsBag(() => {
		// Refresh: include any lazy that was touched
		const names = new Set(availableList);
		for (const key of cache.keys()) names.add(key);
		return [...names].sort();
	});

	return { globals, loaded: availableList, failed, availableList };
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

/** Package names + common SuperCode/require aliases for restricted require(). */
export function getAllowedRequirePackages(): string[] {
	const names = new Set(LIBRARY_ENTRIES.map((e) => e.packageName));
	names.add('crypto');
	// Aliases users often type
	names.add('moment'); // → resolve in restrictedRequire
	names.add('fuse.js');
	names.add('crypto-js');
	names.add('jsonwebtoken');
	names.add('libphonenumber-js');
	return [...names];
}

/** Map require alias → real package name */
export const REQUIRE_ALIASES: Record<string, string> = {
	moment: 'moment-timezone',
	fuse: 'fuse.js',
	CryptoJS: 'crypto-js',
	jwt: 'jsonwebtoken',
	phoneNumber: 'libphonenumber-js',
	YAML: 'yaml',
	papaparse: 'papaparse',
	Papa: 'papaparse',
	cheerio: 'cheerio',
	lodash: 'lodash',
	axios: 'axios',
};
