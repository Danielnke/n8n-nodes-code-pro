/**
 * Smoke-test: require every package and load the library registry after build.
 * Run: npm run build && npm run smoke:libs
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');

const packages = [
	'lodash',
	'axios',
	'cheerio',
	'dayjs',
	'moment-timezone',
	'date-fns',
	'date-fns-tz',
	'joi',
	'validator',
	'uuid',
	'ajv',
	'yup',
	'zod',
	'xml2js',
	'fast-xml-parser',
	'yaml',
	'papaparse',
	'handlebars',
	'crypto-js',
	'node-forge',
	'jsonwebtoken',
	'bcryptjs',
	'xlsx',
	'qrcode',
	'fuse.js',
	'string-similarity',
	'slug',
	'pluralize',
	'qs',
	'form-data',
	'ini',
	'toml',
	'nanoid',
	'bytes',
	'libphonenumber-js',
	'iban',
	'ms',
	'luxon',
	'jmespath',
	'jszip',
	'pako',
	'exceljs',
	'cron-parser',
	'json-diff-ts',
	'html-to-text',
	'marked',
	'p-retry',
	'compromise',
	'franc-min',
	'web3',
	'ccxt',
	'coingecko-api-v3',
	'@solana/web3.js',
	'bitcoinjs-lib',
	'@noble/secp256k1',
	'@scure/bip39',
	'@distube/ytdl-core',
	'fluent-ffmpeg',
	'ffmpeg-static',
	'jimp',
	'image-size',
	'exifr',
	'jpeg-js',
	'pngjs',
];

const ok = [];
const fail = [];

for (const name of packages) {
	try {
		require(name);
		ok.push(name);
		console.log(`OK   ${name}`);
	} catch (e) {
		fail.push({ name, error: e.message });
		console.log(`FAIL ${name}: ${e.message}`);
	}
}

console.log('\n--- registry load ---');
try {
	const reg = require(path.join(__dirname, '..', 'dist', 'src', 'libraryRegistry.js'));
	const result = reg.loadLibraryGlobals();
	console.log(`loaded injects: ${result.loaded.length}`);
	console.log(`failed injects: ${result.failed.length}`);
	if (result.failed.length) {
		for (const f of result.failed.slice(0, 30)) {
			console.log(`  - ${f.inject} (${f.packageName}): ${f.error}`);
		}
	}
	console.log('sample available:', result.availableList.slice(0, 20).join(', '));
} catch (e) {
	console.error('registry load failed:', e);
	process.exitCode = 1;
}

console.log(`\nrequire ok=${ok.length} fail=${fail.length}`);
if (fail.length > 5) {
	// Allow a few optional heavy/native failures; many fails = broken install
	process.exitCode = 1;
}
