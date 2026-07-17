/**
 * Types for utils.sitemap helpers.
 */

export type SitemapKind = 'urlset' | 'sitemapindex' | 'unknown' | null;

export type AttemptReason =
	| 'ok'
	| 'http_error'
	| 'timeout'
	| 'network'
	| 'not_xml'
	| 'empty'
	| 'aborted'
	| 'gzip_error'
	| 'parse_error'
	| 'unknown';

export interface SitemapAttempt {
	url: string;
	ok: boolean;
	status?: number;
	reason?: AttemptReason;
	message?: string;
}

export interface SitemapUrlEntry {
	loc: string;
	lastmod?: string;
	changefreq?: string;
	priority?: string | number;
}

export interface SitemapParseResult {
	kind: SitemapKind;
	/** Page URLs from urlset (loc only). */
	locs: string[];
	/** Child sitemap URLs from sitemapindex. */
	sitemaps: string[];
	/** Rich url entries when present (urlset). */
	urls: SitemapUrlEntry[];
}

export interface SitemapFindOptions {
	timeoutMs?: number;
	concurrency?: number;
	/** Extra or full replacement path list (paths starting with /). */
	paths?: string[];
	/** If true, `paths` replaces defaults instead of extending. */
	replacePaths?: boolean;
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

export interface SitemapFindResult {
	website: string;
	base: string;
	found: boolean;
	sourceUrl: string | null;
	rawXml: string | null;
	kind: SitemapKind;
	attempts: SitemapAttempt[];
	robotsSitemaps: string[];
}

export interface SitemapExpandOptions {
	maxDepth?: number;
	maxSitemaps?: number;
	maxUrls?: number;
	concurrency?: number;
	timeoutMs?: number;
	includeMetadata?: boolean;
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

export interface SitemapExpandResult {
	urls: string[] | SitemapUrlEntry[];
	sitemapsVisited: string[];
	truncated: boolean;
	errors: Array<{ url: string; reason: AttemptReason; message?: string }>;
	kind: SitemapKind;
}

export interface SitemapFromWebsiteOptions extends SitemapFindOptions, SitemapExpandOptions {
	/** When true, expand indexes to page URLs (default false). */
	expand?: boolean;
	/** Include rawXml in result (default true when expand is false). */
	includeRawXml?: boolean;
}

export interface SitemapFromWebsiteResult extends SitemapFindResult {
	urls?: string[] | SitemapUrlEntry[];
	sitemapsVisited?: string[];
	truncated?: boolean;
	errors?: Array<{ url: string; reason: AttemptReason; message?: string }>;
}

export interface SitemapFromWebsitesOptions extends SitemapFromWebsiteOptions {
	/** Concurrent websites (default 3). */
	websiteConcurrency?: number;
}

/** Minimal axios surface used by sitemap HTTP. */
export interface AxiosLike {
	get: (
		url: string,
		config?: Record<string, unknown>,
	) => Promise<{
		status: number;
		data: unknown;
		headers?: Record<string, unknown>;
	}>;
}

export interface SitemapHelpersDeps {
	/** Resolve axios instance (same as sandbox inject when possible). */
	getAxios: () => AxiosLike;
}
