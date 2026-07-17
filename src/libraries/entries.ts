/**
 * Canonical library inject map (inject name → npm package + resolve).
 * Keep load/cache logic out of this file — see registry.ts / loadEntry.ts.
 */

import type { LibraryEntry } from './types';
import { defaultExport } from './moduleInterop';
import { safeLoadFfmpegPath, safeLoadFfprobePath } from './safeBinaries';

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
	// axios is hot-path HTTP — eager so sandbox gets a plain value
	{
		injects: ['axios'],
		packageName: 'axios',
		lazy: false,
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
