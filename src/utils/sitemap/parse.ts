/**
 * Parse sitemap XML (urlset / sitemapindex) without network I/O.
 *
 * fast-xml-parser is required lazily so incomplete community installs don't
 * crash the whole Code Pro package at load time (node still registers).
 */

import { detectKind, looksLikeXml, stripBom } from './detect';
import type { SitemapKind, SitemapParseResult, SitemapUrlEntry } from './types';

type XmlParserInstance = { parse: (xml: string) => unknown };

let parser: XmlParserInstance | null | undefined;

function getParser(): XmlParserInstance | null {
	if (parser !== undefined) return parser;
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { XMLParser } = require('fast-xml-parser') as {
			XMLParser: new (opts: Record<string, unknown>) => XmlParserInstance;
		};
		parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			removeNSPrefix: true,
			trimValues: true,
			isArray: (name: string) => {
				const n = String(name).toLowerCase();
				return n === 'url' || n === 'sitemap' || n === 'loc';
			},
		});
	} catch {
		parser = null;
	}
	return parser;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
	if (value == null) return [];
	return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string {
	if (node == null) return '';
	if (Array.isArray(node)) return textOf(node[0]);
	if (typeof node === 'string' || typeof node === 'number') return String(node).trim();
	if (typeof node === 'object') {
		const o = node as Record<string, unknown>;
		if (typeof o['#text'] === 'string' || typeof o['#text'] === 'number') {
			return String(o['#text']).trim();
		}
		if ('loc' in o) return textOf(o.loc);
	}
	return '';
}

function extractLocsFromEntries(entries: unknown[]): { locs: string[]; urls: SitemapUrlEntry[] } {
	const locs: string[] = [];
	const urls: SitemapUrlEntry[] = [];
	const seen = new Set<string>();

	for (const entry of entries) {
		if (entry == null) continue;
		if (typeof entry === 'string') {
			const loc = entry.trim();
			if (loc && !seen.has(loc)) {
				seen.add(loc);
				locs.push(loc);
				urls.push({ loc });
			}
			continue;
		}
		if (typeof entry !== 'object') continue;
		const o = entry as Record<string, unknown>;
		const loc = textOf(o.loc);
		if (!loc || seen.has(loc)) continue;
		seen.add(loc);
		locs.push(loc);
		const item: SitemapUrlEntry = { loc };
		const lastmod = textOf(o.lastmod);
		const changefreq = textOf(o.changefreq);
		const priority = textOf(o.priority);
		if (lastmod) item.lastmod = lastmod;
		if (changefreq) item.changefreq = changefreq;
		if (priority) item.priority = priority;
		urls.push(item);
	}
	return { locs, urls };
}

/**
 * Fallback: regex scrape of <loc> when XML parser fails or returns empty.
 */
export function scrapeLocs(rawXml: string): string[] {
	const text = stripBom(rawXml);
	const re = /<loc[^>]*>\s*([^<]+?)\s*<\/loc>/gi;
	const out: string[] = [];
	const seen = new Set<string>();
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		const loc = m[1].trim();
		if (loc && !seen.has(loc)) {
			seen.add(loc);
			out.push(loc);
		}
	}
	return out;
}

export function parseSitemapXml(rawXml: string | null | undefined): SitemapParseResult {
	const empty: SitemapParseResult = { kind: null, locs: [], sitemaps: [], urls: [] };
	if (rawXml == null || typeof rawXml !== 'string' || !rawXml.trim()) {
		return empty;
	}
	if (!looksLikeXml(rawXml)) {
		return empty;
	}

	const kindHint = detectKind(rawXml);
	let kind: SitemapKind = kindHint;

	const xmlParser = getParser();
	if (!xmlParser) {
		// Package missing / incomplete install — still return locs via regex
		const scraped = scrapeLocs(rawXml);
		if (!scraped.length) {
			return { kind: kindHint, locs: [], sitemaps: [], urls: [] };
		}
		if (kindHint === 'sitemapindex') {
			return { kind: 'sitemapindex', locs: [], sitemaps: scraped, urls: [] };
		}
		return {
			kind: kindHint ?? 'unknown',
			locs: scraped,
			sitemaps: [],
			urls: scraped.map((loc) => ({ loc })),
		};
	}

	try {
		const doc = xmlParser.parse(stripBom(rawXml)) as Record<string, unknown>;
		// Roots may be urlset / sitemapindex (ns already stripped)
		const urlset = (doc.urlset ?? doc.URLSET) as Record<string, unknown> | undefined;
		const sitemapindex = (doc.sitemapindex ?? doc.sitemapIndex ?? doc.SITEMAPINDEX) as
			| Record<string, unknown>
			| undefined;

		if (urlset && typeof urlset === 'object') {
			kind = 'urlset';
			const { locs, urls } = extractLocsFromEntries(asArray(urlset.url));
			if (locs.length === 0) {
				const scraped = scrapeLocs(rawXml);
				return {
					kind,
					locs: scraped,
					sitemaps: [],
					urls: scraped.map((loc) => ({ loc })),
				};
			}
			return { kind, locs, sitemaps: [], urls };
		}

		if (sitemapindex && typeof sitemapindex === 'object') {
			kind = 'sitemapindex';
			const { locs } = extractLocsFromEntries(asArray(sitemapindex.sitemap));
			if (locs.length === 0) {
				const scraped = scrapeLocs(rawXml);
				return { kind, locs: [], sitemaps: scraped, urls: [] };
			}
			return { kind, locs: [], sitemaps: locs, urls: [] };
		}

		// Unknown root — try scrape
		const scraped = scrapeLocs(rawXml);
		if (scraped.length) {
			if (kind === 'sitemapindex') {
				return { kind, locs: [], sitemaps: scraped, urls: [] };
			}
			return {
				kind: kind ?? 'unknown',
				locs: scraped,
				sitemaps: [],
				urls: scraped.map((loc) => ({ loc })),
			};
		}
		return { kind: kind ?? 'unknown', locs: [], sitemaps: [], urls: [] };
	} catch {
		const scraped = scrapeLocs(rawXml);
		if (!scraped.length) {
			return { kind: kindHint ?? 'unknown', locs: [], sitemaps: [], urls: [] };
		}
		if (kindHint === 'sitemapindex') {
			return { kind: 'sitemapindex', locs: [], sitemaps: scraped, urls: [] };
		}
		return {
			kind: kindHint ?? 'unknown',
			locs: scraped,
			sitemaps: [],
			urls: scraped.map((loc) => ({ loc })),
		};
	}
}
