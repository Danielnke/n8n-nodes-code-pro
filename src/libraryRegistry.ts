/**
 * Canonical library inject map for Code Pro.
 * Built-in automation injects + image/video tooling.
 *
 * Default is lazy load — first Code Pro run must not require() heavy trees
 * (web3/ccxt/ffmpeg/jimp/…) unless user code touches those globals.
 *
 * CRITICAL: never bare-require packages that call process.exit on bad platforms
 * (e.g. ffprobe-static). Always platform-precheck + existsSync.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';

import { createUtilsBag } from './utilsBag';

export interface LibraryEntry {
	/** Inject global name(s) */
	injects: string[];
	/** npm package name */
	packageName: string;
	/**
	 * Lazy-load on first access.
	 * Default true. Set false only for tiny always-used core (default template).
	 */
	lazy?: boolean;
	/** Prefer stub over throw when package missing (still tries load). */
	optional?: boolean;
	/** Map required module → injected value(s). Default: module itself for each inject. */
	resolve?: (mod: unknown) => Record<string, unknown>;
}

/** Marker on missing-library stubs (do not count as "available"). */
export const CODE_PRO_MISSING = Symbol.for('n8n-nodes-code-pro.missingLibrary');

export function isMissingLibrary(value: unknown): boolean {
	if (value == null) return true;
	if (typeof value === 'function' || typeof value === 'object') {
		try {
			return Boolean((value as Record<symbol, unknown>)[CODE_PRO_MISSING]);
		} catch {
			return false;
		}
	}
	return false;
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
 * ffprobe-static calls process.exit(1) on unsupported platform/arch at require time.
 * Never require it without this precheck.
 */
export function safeLoadFfprobePath(): string | null {
	const platform = os.platform();
	const arch = os.arch();
	if (platform !== 'darwin' && platform !== 'linux' && platform !== 'win32') {
		return null;
	}
	if (platform === 'darwin' && arch !== 'x64' && arch !== 'arm64') {
		return null;
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const probe = require('ffprobe-static') as { path?: string };
		const p = probe?.path;
		if (typeof p === 'string' && fs.existsSync(p)) {
			return p;
		}
	} catch {
		/* optional binary package */
	}
	return null;
}

export function safeLoadFfmpegPath(): string | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const ffPath = require('ffmpeg-static') as string | null;
		if (typeof ffPath === 'string' && fs.existsSync(ffPath)) {
			return ffPath;
		}
	} catch {
		/* optional binary package */
	}
	return null;
}

/**
 * Only default-template core is eager; everything else is lazy.
 */
export const LIBRARY_ENTRIES: LibraryEntry[] = [
	// --- Default template core (eager, tiny) ---
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
			const fn = m.nanoid;
			if (typeof fn === 'function') {
				const callable = Object.assign(fn.bind(m), m);
				return { nanoid: callable };
			}
			return { nanoid: m };
		},
	},
	{ injects: ['dayjs'], packageName: 'dayjs', lazy: false },

	// --- Dates (lazy) ---
	{
		injects: ['moment'],
		packageName: 'moment-timezone',
		lazy: true,
		resolve: (mod) => ({ moment: defaultExport(mod) }),
	},
	{
		injects: ['dateFns'],
		packageName: 'date-fns',
		lazy: true,
		resolve: (mod) => ({ dateFns: mod }),
	},
	{
		injects: ['dateFnsTz'],
		packageName: 'date-fns-tz',
		lazy: true,
		resolve: (mod) => ({ dateFnsTz: mod }),
	},
	{
		injects: ['luxon', 'DateTime'],
		packageName: 'luxon',
		lazy: true,
		resolve: (mod) => {
			const m = mod as { DateTime: unknown };
			return { luxon: m, DateTime: m.DateTime };
		},
	},
	{
		injects: ['cronParser'],
		packageName: 'cron-parser',
		lazy: true,
		resolve: (mod) => ({ cronParser: defaultExport(mod) ?? mod }),
	},

	// --- Validation ---
	{
		injects: ['joi', 'Joi'],
		packageName: 'joi',
		lazy: true,
		resolve: (mod) => {
			const j = defaultExport(mod);
			return { joi: j, Joi: j };
		},
	},
	{ injects: ['validator'], packageName: 'validator', lazy: true },
	{
		injects: ['Ajv'],
		packageName: 'ajv',
		lazy: true,
		resolve: (mod) => ({ Ajv: defaultExport(mod) }),
	},
	{ injects: ['yup'], packageName: 'yup', lazy: true, optional: true },
	{
		injects: ['z', 'zod'],
		packageName: 'zod',
		lazy: true,
		resolve: (mod) => {
			const z = defaultExport(mod);
			return { z, zod: z };
		},
	},
	{
		injects: ['phoneNumber'],
		packageName: 'libphonenumber-js',
		lazy: true,
		resolve: (mod) => ({ phoneNumber: mod }),
	},
	{ injects: ['iban'], packageName: 'iban', lazy: true },

	// --- Parse / formats ---
	{ injects: ['xml2js'], packageName: 'xml2js', lazy: true },
	{
		injects: ['XMLParser', 'XMLBuilder'],
		packageName: 'fast-xml-parser',
		lazy: true,
		resolve: (mod) => {
			const m = mod as { XMLParser: unknown; XMLBuilder: unknown };
			return { XMLParser: m.XMLParser, XMLBuilder: m.XMLBuilder };
		},
	},
	{
		injects: ['YAML'],
		packageName: 'yaml',
		lazy: true,
		resolve: (mod) => ({ YAML: mod }),
	},
	{
		injects: ['papaparse', 'Papa'],
		packageName: 'papaparse',
		lazy: true,
		resolve: (mod) => {
			const p = defaultExport(mod);
			return { papaparse: p, Papa: p };
		},
	},
	{ injects: ['ini'], packageName: 'ini', lazy: true },
	{ injects: ['toml'], packageName: 'toml', lazy: true },
	{ injects: ['jmespath'], packageName: 'jmespath', lazy: true },
	{
		injects: ['jsonDiff'],
		packageName: 'json-diff-ts',
		lazy: true,
		resolve: (mod) => ({ jsonDiff: mod }),
	},

	// --- HTML / text ---
	{ injects: ['cheerio'], packageName: 'cheerio', lazy: true, optional: true },
	{
		injects: ['Handlebars'],
		packageName: 'handlebars',
		lazy: true,
		resolve: (mod) => ({ Handlebars: defaultExport(mod) }),
	},
	{
		// Callable htmlToText(html), not { convert }
		injects: ['htmlToText'],
		packageName: 'html-to-text',
		lazy: true,
		resolve: (mod) => {
			const m = mod as { htmlToText?: unknown; convert?: unknown };
			const fn = m.htmlToText ?? m.convert ?? defaultExport(mod) ?? mod;
			return { htmlToText: fn };
		},
	},
	{
		injects: ['marked'],
		packageName: 'marked',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ marked: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['slug'],
		packageName: 'slug',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ slug: defaultExport(mod) }),
	},
	{ injects: ['pluralize'], packageName: 'pluralize', lazy: true },
	{
		injects: ['fuzzy'],
		packageName: 'fuse.js',
		lazy: true,
		resolve: (mod) => ({ fuzzy: defaultExport(mod) }),
	},
	{
		injects: ['stringSimilarity'],
		packageName: 'string-similarity',
		lazy: true,
		resolve: (mod) => ({ stringSimilarity: defaultExport(mod) ?? mod }),
	},
	{
		// franc-min is ESM; Node 20.19+/22 can require() it. optional if host cannot.
		injects: ['franc'],
		packageName: 'franc-min',
		lazy: true,
		optional: true,
		resolve: (mod) => {
			const m = mod as { franc?: unknown; default?: unknown };
			const fn = m.franc ?? defaultExport(mod) ?? mod;
			return { franc: fn };
		},
	},
	{
		injects: ['compromise'],
		packageName: 'compromise',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ compromise: defaultExport(mod) }),
	},

	// --- Crypto ---
	{
		injects: ['CryptoJS'],
		packageName: 'crypto-js',
		lazy: true,
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
		lazy: true,
		resolve: (mod) => ({ jwt: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['bcrypt', 'bcryptjs'],
		packageName: 'bcryptjs',
		lazy: true,
		optional: true,
		resolve: (mod) => {
			const b = defaultExport(mod);
			return { bcrypt: b, bcryptjs: b };
		},
	},
	{
		injects: ['nodeCrypto'],
		packageName: 'crypto',
		lazy: true,
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
		lazy: true,
		resolve: (mod) => ({ axios: defaultExport(mod) }),
	},
	{
		injects: ['FormData'],
		packageName: 'form-data',
		lazy: true,
		resolve: (mod) => ({ FormData: defaultExport(mod) }),
	},
	{
		injects: ['pRetry'],
		packageName: 'p-retry',
		lazy: true,
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

	// --- Image automation (pure JS preferred; lazy) ---
	{
		injects: ['Jimp', 'jimp'],
		packageName: 'jimp',
		lazy: true,
		optional: true,
		resolve: (mod) => {
			const J = defaultExport(mod) ?? mod;
			return { Jimp: J, jimp: J };
		},
	},
	{
		injects: ['imageSize'],
		packageName: 'image-size',
		lazy: true,
		optional: true,
		resolve: (mod) => {
			const m = defaultExport(mod) ?? mod;
			return { imageSize: m };
		},
	},
	{
		injects: ['exifr'],
		packageName: 'exifr',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ exifr: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['JPEG'],
		packageName: 'jpeg-js',
		lazy: true,
		optional: true,
		resolve: (mod) => ({ JPEG: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['PNG'],
		packageName: 'pngjs',
		lazy: true,
		optional: true,
		resolve: (mod) => {
			const m = mod as { PNG?: unknown };
			return { PNG: m.PNG ?? defaultExport(mod) ?? mod };
		},
	},

	// --- Video automation (lazy; binary-safe path wiring) ---
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
		resolve: (mod) => {
			const ffmpeg = defaultExport(mod) as {
				setFfmpegPath?: (p: string) => void;
				setFfprobePath?: (p: string) => void;
			};
			// Safe path wiring — never process.exit; only set when binary exists
			const ffPath = safeLoadFfmpegPath();
			if (ffPath && typeof ffmpeg.setFfmpegPath === 'function') {
				ffmpeg.setFfmpegPath(ffPath);
			}
			const probePath = safeLoadFfprobePath();
			if (probePath && typeof ffmpeg.setFfprobePath === 'function') {
				ffmpeg.setFfprobePath(probePath);
			}
			return { ffmpeg };
		},
	},
	{
		injects: ['ffmpegStatic'],
		packageName: 'ffmpeg-static',
		lazy: true,
		optional: true,
		resolve: () => {
			const p = safeLoadFfmpegPath();
			if (p == null) {
				throw new Error(
					'ffmpeg-static binary not found for this platform (or postinstall download failed). Install system ffmpeg or reinstall ffmpeg-static.',
				);
			}
			return { ffmpegStatic: p };
		},
	},
	{
		injects: ['ffprobeStatic'],
		packageName: 'ffprobe-static',
		lazy: true,
		optional: true,
		resolve: () => {
			// NEVER require('ffprobe-static') without platform precheck — it can process.exit(1)
			const p = safeLoadFfprobePath();
			if (p == null) {
				throw new Error(
					'ffprobe-static binary not available for this platform/arch (or package missing). Video metadata via ffprobe will not work.',
				);
			}
			return { ffprobeStatic: p };
		},
	},
];

function createMissingStub(injectName: string, packageName: string): unknown {
	const message = `Code Pro library '${injectName}' is not available (failed to load npm package '${packageName}'). Check install, platform binaries, or ESM compatibility.`;
	const handler: ProxyHandler<object> = {
		get(_t, prop) {
			if (prop === CODE_PRO_MISSING) return true;
			if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'valueOf') {
				return () => `[missing library ${injectName}]`;
			}
			if (prop === 'then') return undefined; // not a thenable
			throw new Error(message);
		},
		apply() {
			throw new Error(message);
		},
	};
	const fn = () => {
		throw new Error(message);
	};
	Object.defineProperty(fn, CODE_PRO_MISSING, {
		value: true,
		enumerable: false,
		configurable: false,
	});
	return new Proxy(fn, handler);
}

function loadEntry(entry: LibraryEntry): {
	values: Record<string, unknown>;
	error?: string;
} {
	try {
		// Binary packages: never bare-require when we have safe loaders
		if (entry.packageName === 'ffprobe-static') {
			const p = safeLoadFfprobePath();
			if (p == null) {
				return {
					values: {},
					error: 'ffprobe-static binary unavailable for this platform/arch',
				};
			}
			const resolved = entry.resolve
				? entry.resolve({ path: p })
				: Object.fromEntries(entry.injects.map((name) => [name, p]));
			return { values: resolved };
		}
		if (entry.packageName === 'ffmpeg-static') {
			const p = safeLoadFfmpegPath();
			if (p == null) {
				return {
					values: {},
					error: 'ffmpeg-static binary unavailable',
				};
			}
			const resolved = entry.resolve
				? entry.resolve(p)
				: Object.fromEntries(entry.injects.map((name) => [name, p]));
			return { values: resolved };
		}

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
	/** All registered inject names (including lazy). */
	loaded: string[];
	failed: Array<{ inject: string; packageName: string; error: string }>;
	/** Registered minus known failures / stubs (optimistic for untouched lazy). */
	availableList: string[];
}

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

/** Package names + common require aliases for restricted require(). */
export function getAllowedRequirePackages(): string[] {
	const names = new Set(LIBRARY_ENTRIES.map((e) => e.packageName));
	names.add('crypto');
	// Aliases users often type
	names.add('moment');
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
	jimp: 'jimp',
	Jimp: 'jimp',
	ffmpeg: 'fluent-ffmpeg',
};
