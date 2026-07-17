/**
 * Restricted require() allowlist + alias map for the VM sandbox.
 */

import { LIBRARY_ENTRIES } from './entries';

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
