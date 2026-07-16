/**
 * Canonical library inject map for Code Pro.
 * SuperCode-parity names + Code Pro extras.
 */

import { createUtilsBag } from './utilsBag';

export interface LibraryEntry {
	/** Inject global name(s) */
	injects: string[];
	/** npm package name */
	packageName: string;
	/** If true, skip eager load failures silently (lazy heavies still attempted). */
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

/** SuperCode-parity + extras. Order does not matter. */
export const LIBRARY_ENTRIES: LibraryEntry[] = [
	// --- Data / utils ---
	{
		injects: ['_', 'lodash'],
		packageName: 'lodash',
		resolve: (mod) => {
			const _ = defaultExport(mod);
			return { _: _, lodash: _ };
		},
	},
	{ injects: ['bytes'], packageName: 'bytes' },
	{ injects: ['ms'], packageName: 'ms' },
	{ injects: ['qs'], packageName: 'qs' },
	{
		injects: ['uuid'],
		packageName: 'uuid',
		resolve: (mod) => ({ uuid: mod }),
	},
	{
		injects: ['nanoid'],
		packageName: 'nanoid',
		resolve: (mod) => {
			const m = mod as { nanoid?: unknown } | ((...a: unknown[]) => unknown);
			if (typeof m === 'function') return { nanoid: { nanoid: m } };
			const n = (m as { nanoid?: unknown }).nanoid ?? m;
			return { nanoid: { nanoid: n } };
		},
	},

	// --- Dates ---
	{ injects: ['dayjs'], packageName: 'dayjs' },
	{
		injects: ['moment'],
		packageName: 'moment-timezone',
		resolve: (mod) => ({ moment: defaultExport(mod) }),
	},
	{
		injects: ['dateFns'],
		packageName: 'date-fns',
		resolve: (mod) => ({ dateFns: mod }),
	},
	{
		injects: ['dateFnsTz'],
		packageName: 'date-fns-tz',
		resolve: (mod) => ({ dateFnsTz: mod }),
	},
	{
		injects: ['luxon', 'DateTime'],
		packageName: 'luxon',
		resolve: (mod) => {
			const m = mod as { DateTime: unknown; Duration: unknown; Interval: unknown };
			return { luxon: m, DateTime: m.DateTime };
		},
	},
	{
		injects: ['cronParser'],
		packageName: 'cron-parser',
		resolve: (mod) => ({ cronParser: defaultExport(mod) ?? mod }),
	},

	// --- Validation ---
	{
		injects: ['joi', 'Joi'],
		packageName: 'joi',
		resolve: (mod) => {
			const j = defaultExport(mod);
			return { joi: j, Joi: j };
		},
	},
	{ injects: ['validator'], packageName: 'validator' },
	{
		injects: ['Ajv'],
		packageName: 'ajv',
		resolve: (mod) => ({ Ajv: defaultExport(mod) }),
	},
	{ injects: ['yup'], packageName: 'yup', optional: true },
	{
		injects: ['z', 'zod'],
		packageName: 'zod',
		resolve: (mod) => {
			const z = defaultExport(mod);
			return { z, zod: z };
		},
	},
	{
		injects: ['phoneNumber'],
		packageName: 'libphonenumber-js',
		resolve: (mod) => ({ phoneNumber: mod }),
	},
	{ injects: ['iban'], packageName: 'iban' },

	// --- Parse / formats ---
	{ injects: ['xml2js'], packageName: 'xml2js' },
	{
		injects: ['XMLParser', 'XMLBuilder'],
		packageName: 'fast-xml-parser',
		resolve: (mod) => {
			const m = mod as { XMLParser: unknown; XMLBuilder: unknown };
			return { XMLParser: m.XMLParser, XMLBuilder: m.XMLBuilder };
		},
	},
	{
		injects: ['YAML'],
		packageName: 'yaml',
		resolve: (mod) => ({ YAML: mod }),
	},
	{
		injects: ['papaparse', 'Papa'],
		packageName: 'papaparse',
		resolve: (mod) => {
			const p = defaultExport(mod);
			return { papaparse: p, Papa: p };
		},
	},
	{ injects: ['ini'], packageName: 'ini' },
	{ injects: ['toml'], packageName: 'toml' },
	{ injects: ['jmespath'], packageName: 'jmespath' },
	{
		injects: ['jsonDiff'],
		packageName: 'json-diff-ts',
		resolve: (mod) => ({ jsonDiff: mod }),
	},

	// --- HTML / text / templates ---
	{ injects: ['cheerio'], packageName: 'cheerio', optional: true },
	{
		injects: ['Handlebars'],
		packageName: 'handlebars',
		resolve: (mod) => ({ Handlebars: defaultExport(mod) }),
	},
	{
		injects: ['htmlToText'],
		packageName: 'html-to-text',
		resolve: (mod) => ({ htmlToText: mod }),
	},
	{
		injects: ['marked'],
		packageName: 'marked',
		optional: true,
		resolve: (mod) => ({ marked: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['slug'],
		packageName: 'slug',
		optional: true,
		resolve: (mod) => ({ slug: defaultExport(mod) }),
	},
	{ injects: ['pluralize'], packageName: 'pluralize' },
	{
		injects: ['fuzzy'],
		packageName: 'fuse.js',
		resolve: (mod) => ({ fuzzy: defaultExport(mod) }),
	},
	{
		injects: ['stringSimilarity'],
		packageName: 'string-similarity',
		resolve: (mod) => ({ stringSimilarity: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['franc'],
		packageName: 'franc-min',
		optional: true,
		resolve: (mod) => ({ franc: defaultExport(mod) }),
	},
	{
		injects: ['compromise'],
		packageName: 'compromise',
		optional: true,
		resolve: (mod) => ({ compromise: defaultExport(mod) }),
	},

	// --- Crypto ---
	{
		injects: ['CryptoJS'],
		packageName: 'crypto-js',
		resolve: (mod) => ({ CryptoJS: defaultExport(mod) }),
	},
	{
		injects: ['forge'],
		packageName: 'node-forge',
		optional: true,
		resolve: (mod) => ({ forge: defaultExport(mod) }),
	},
	{
		injects: ['jwt'],
		packageName: 'jsonwebtoken',
		resolve: (mod) => ({ jwt: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['bcrypt', 'bcryptjs'],
		packageName: 'bcryptjs',
		optional: true,
		resolve: (mod) => {
			const b = defaultExport(mod);
			return { bcrypt: b, bcryptjs: b };
		},
	},
	{
		injects: ['nodeCrypto'],
		packageName: 'crypto',
		resolve: (mod) => ({ nodeCrypto: mod }),
	},
	{
		injects: ['secp256k1'],
		packageName: '@noble/secp256k1',
		optional: true,
		resolve: (mod) => ({ secp256k1: mod }),
	},
	{
		injects: ['bip39'],
		packageName: '@scure/bip39',
		optional: true,
		resolve: (mod) => ({ bip39: mod }),
	},

	// --- Network ---
	{
		injects: ['axios'],
		packageName: 'axios',
		resolve: (mod) => ({ axios: defaultExport(mod) }),
	},
	{
		injects: ['FormData'],
		packageName: 'form-data',
		resolve: (mod) => ({ FormData: defaultExport(mod) }),
	},
	{
		injects: ['pRetry'],
		packageName: 'p-retry',
		optional: true,
		resolve: (mod) => ({ pRetry: defaultExport(mod) }),
	},

	// --- Files / excel / zip ---
	{
		injects: ['XLSX', 'xlsx'],
		packageName: 'xlsx',
		optional: true,
		resolve: (mod) => {
			const x = defaultExport(mod) ?? mod;
			return { XLSX: x, xlsx: x };
		},
	},
	{
		injects: ['ExcelJS'],
		packageName: 'exceljs',
		optional: true,
		resolve: (mod) => ({ ExcelJS: defaultExport(mod) }),
	},
	{
		injects: ['JSZip'],
		packageName: 'jszip',
		optional: true,
		resolve: (mod) => ({ JSZip: defaultExport(mod) }),
	},
	{
		injects: ['pako'],
		packageName: 'pako',
		optional: true,
		resolve: (mod) => ({ pako: defaultExport(mod) }),
	},
	{
		injects: ['QRCode'],
		packageName: 'qrcode',
		optional: true,
		resolve: (mod) => ({ QRCode: defaultExport(mod) ?? mod }),
	},

	// --- Heavy / blockchain / media (optional lazy) ---
	{
		injects: ['web3'],
		packageName: 'web3',
		optional: true,
		resolve: (mod) => ({ web3: defaultExport(mod) }),
	},
	{
		injects: ['ccxt'],
		packageName: 'ccxt',
		optional: true,
		resolve: (mod) => ({ ccxt: defaultExport(mod) }),
	},
	{
		injects: ['coinGecko'],
		packageName: 'coingecko-api-v3',
		optional: true,
		resolve: (mod) => ({ coinGecko: defaultExport(mod) ?? mod }),
	},
	{
		injects: ['solana'],
		packageName: '@solana/web3.js',
		optional: true,
		resolve: (mod) => ({ solana: mod }),
	},
	{
		injects: ['bitcoin'],
		packageName: 'bitcoinjs-lib',
		optional: true,
		resolve: (mod) => ({ bitcoin: mod }),
	},
	{
		injects: ['ytdl'],
		packageName: '@distube/ytdl-core',
		optional: true,
		resolve: (mod) => ({ ytdl: defaultExport(mod) }),
	},
	{
		injects: ['ffmpeg'],
		packageName: 'fluent-ffmpeg',
		optional: true,
		resolve: (mod) => ({ ffmpeg: defaultExport(mod) }),
	},
	{
		injects: ['ffmpegStatic'],
		packageName: 'ffmpeg-static',
		optional: true,
		resolve: (mod) => ({ ffmpegStatic: defaultExport(mod) ?? mod }),
	},
];

function createMissingStub(injectName: string, packageName: string): unknown {
	const handler: ProxyHandler<object> = {
		get() {
			throw new Error(
				`Code Pro library '${injectName}' is not available (failed to load npm package '${packageName}'). Check install logs or package ESM compatibility.`,
			);
		},
		apply() {
			throw new Error(
				`Code Pro library '${injectName}' is not available (failed to load npm package '${packageName}').`,
			);
		},
	};
	// Function proxy so both foo() and foo.bar work as throw
	const fn = () => {
		throw new Error(
			`Code Pro library '${injectName}' is not available (failed to load npm package '${packageName}').`,
		);
	};
	return new Proxy(fn, handler);
}

export interface LoadLibrariesResult {
	globals: Record<string, unknown>;
	loaded: string[];
	failed: Array<{ inject: string; packageName: string; error: string }>;
	availableList: string[];
}

/**
 * Load all registered libraries into a globals map for the VM sandbox.
 */
export function loadLibraryGlobals(): LoadLibrariesResult {
	const globals: Record<string, unknown> = {};
	const loaded: string[] = [];
	const failed: LoadLibrariesResult['failed'] = [];

	for (const entry of LIBRARY_ENTRIES) {
		try {
			const mod = req(entry.packageName);
			const resolved = entry.resolve
				? entry.resolve(mod)
				: Object.fromEntries(entry.injects.map((name) => [name, defaultExport(mod)]));

			for (const [name, value] of Object.entries(resolved)) {
				if (value !== undefined) {
					globals[name] = value;
					loaded.push(name);
				} else {
					globals[name] = createMissingStub(name, entry.packageName);
					failed.push({
						inject: name,
						packageName: entry.packageName,
						error: 'resolved to undefined',
					});
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			for (const name of entry.injects) {
				globals[name] = createMissingStub(name, entry.packageName);
				failed.push({ inject: name, packageName: entry.packageName, error: message });
			}
		}
	}

	const availableList = loaded.slice().sort();
	globals.utils = createUtilsBag(() => availableList);

	return { globals, loaded, failed, availableList };
}

/** Cache loaded libs per process (heavy packages load once). */
let cached: LoadLibrariesResult | undefined;

export function getLibraryGlobals(): LoadLibrariesResult {
	if (!cached) {
		cached = loadLibraryGlobals();
	}
	return cached;
}

/** Test helper / hot-reload in dev */
export function clearLibraryCache(): void {
	cached = undefined;
}
