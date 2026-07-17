/**
 * Detect sitemap XML shape without full parse.
 */

import type { SitemapKind } from './types';

const BOM = /^\uFEFF/;

export function stripBom(text: string): string {
	return String(text ?? '').replace(BOM, '');
}

/**
 * Heuristic: body looks like sitemap-related XML (not HTML soft-404).
 */
export function looksLikeXml(text: string | null | undefined): boolean {
	if (text == null || typeof text !== 'string') return false;
	const head = stripBom(text).trim().slice(0, 400).toLowerCase();
	if (!head) return false;
	if (head.startsWith('<!doctype html') || head.startsWith('<html')) return false;
	return (
		head.startsWith('<?xml') ||
		head.includes('<urlset') ||
		head.includes('<sitemapindex') ||
		head.includes('<sitemap ') ||
		head.includes('<url ')
	);
}

/**
 * Classify root element kind from raw XML text.
 */
export function detectKind(text: string | null | undefined): SitemapKind {
	if (!looksLikeXml(text)) return null;
	const head = stripBom(String(text)).trim().slice(0, 2000).toLowerCase();
	if (head.includes('<sitemapindex')) return 'sitemapindex';
	if (head.includes('<urlset')) return 'urlset';
	return 'unknown';
}

/**
 * True if URL or content-type suggests gzip.
 */
export function suggestsGzip(
	url: string,
	contentType?: string | null,
	contentEncoding?: string | null,
): boolean {
	const u = String(url ?? '').toLowerCase();
	if (u.endsWith('.gz') || u.endsWith('.xml.gz') || u.includes('.xml.gz?')) return true;
	const enc = String(contentEncoding ?? '').toLowerCase();
	if (enc.includes('gzip') || enc.includes('x-gzip')) return true;
	const ct = String(contentType ?? '').toLowerCase();
	if (ct.includes('gzip') || ct.includes('x-gzip') || ct.includes('application/x-gzip')) return true;
	return false;
}
