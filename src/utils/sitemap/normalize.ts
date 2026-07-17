/**
 * Normalize website / base URLs for sitemap discovery.
 */

/**
 * Turn user input into an origin-style base: `https://host` (no trailing slash, no path).
 * Accepts `example.com`, `https://example.com/foo`, etc.
 */
export function normalizeBase(url: string | null | undefined): string {
	let u = String(url ?? '').trim();
	if (!u) return '';
	if (!/^https?:\/\//i.test(u)) {
		u = `https://${u}`;
	}
	try {
		const parsed = new URL(u);
		// origin is scheme://host[:port] without trailing slash
		return parsed.origin;
	} catch {
		// Fallback: strip path-ish trailing junk
		u = u.replace(/\/+$/, '');
		return u;
	}
}

/**
 * Resolve a candidate sitemap URL against a base origin.
 */
export function resolveSitemapUrl(base: string, candidate: string): string {
	const c = String(candidate ?? '').trim();
	if (!c) return '';
	if (/^https?:\/\//i.test(c)) return c;
	try {
		return new URL(c.startsWith('/') ? c : `/${c}`, base.endsWith('/') ? base : `${base}/`).href;
	} catch {
		return `${base.replace(/\/+$/, '')}/${c.replace(/^\/+/, '')}`;
	}
}
