/**
 * Hard limits for sitemap network and expansion work.
 */

export const SITEMAP_PROTOCOL_MAX_BYTES = 52_428_800;
export const DEFAULT_SITEMAP_MAX_BYTES = 20 * 1024 * 1024;
export const DEFAULT_ROBOTS_MAX_BYTES = 1024 * 1024;
export const MAX_REQUEST_CONCURRENCY = 16;
export const MAX_WEBSITE_CONCURRENCY = 8;
export const MAX_SITEMAPS = 500;
export const MAX_SITEMAP_DEPTH = 10;
export const MAX_SITEMAP_URLS = 1_000_000;
export const MAX_DISCOVERY_CANDIDATES = 100;
export const MAX_ROBOTS_SITEMAPS = 50;
export const MAX_REQUEST_TIMEOUT_MS = 120_000;

export function clampInteger(
	raw: unknown,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	const value = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(value)) return fallback;
	return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

export function normalizeSitemapByteLimit(raw: unknown): number {
	return clampInteger(
		raw,
		DEFAULT_SITEMAP_MAX_BYTES,
		1,
		SITEMAP_PROTOCOL_MAX_BYTES,
	);
}

export function normalizeTimeoutMs(raw: unknown): number {
	return clampInteger(raw, 8000, 250, MAX_REQUEST_TIMEOUT_MS);
}
