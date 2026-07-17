/**
 * Expand sitemap indexes (and nested indexes) into page URLs.
 */

import { mapPool } from '../mapPool';
import { detectKind } from './detect';
import { fetchSitemapXml } from './http';
import { parseSitemapXml } from './parse';
import type {
	AttemptReason,
	AxiosLike,
	SitemapExpandOptions,
	SitemapExpandResult,
	SitemapUrlEntry,
} from './types';

export interface ExpandInput {
	/** Starting sitemap URL, or raw XML string. */
	source: string;
	/** If true, `source` is raw XML (not a URL). */
	isXml?: boolean;
	/** Optional label URL when expanding raw XML. */
	sourceUrl?: string;
}

/**
 * Expand from a URL or raw XML into page URL list (strings or metadata objects).
 */
export async function expandSitemap(
	axios: AxiosLike,
	input: ExpandInput | string,
	options: SitemapExpandOptions = {},
): Promise<SitemapExpandResult> {
	const maxDepth = options.maxDepth ?? 3;
	const maxSitemaps = options.maxSitemaps ?? 50;
	const maxUrls = options.maxUrls ?? 10_000;
	const concurrency = options.concurrency ?? 4;
	const timeoutMs = options.timeoutMs ?? 8000;
	const includeMetadata = options.includeMetadata === true;

	const normalized: ExpandInput =
		typeof input === 'string' ? { source: input, isXml: false } : input;

	const sitemapsVisited: string[] = [];
	const errors: Array<{ url: string; reason: AttemptReason; message?: string }> = [];
	const pageLocs: string[] = [];
	const pageMeta: SitemapUrlEntry[] = [];
	const seenPages = new Set<string>();
	const seenSitemaps = new Set<string>();

	let truncated = false;
	let rootKind = detectKind(normalized.isXml ? normalized.source : null);

	type QueueItem = { url: string; depth: number; xml?: string };
	const queue: QueueItem[] = [];

	if (normalized.isXml) {
		const label = normalized.sourceUrl || '(inline-xml)';
		queue.push({ url: label, depth: 0, xml: normalized.source });
	} else {
		const url = String(normalized.source ?? '').trim();
		if (!url) {
			return {
				urls: includeMetadata ? [] : [],
				sitemapsVisited: [],
				truncated: false,
				errors: [{ url: '', reason: 'empty', message: 'No sitemap source' }],
				kind: null,
			};
		}
		queue.push({ url, depth: 0 });
	}

	async function loadXml(item: QueueItem): Promise<string | null> {
		if (item.xml) return item.xml;
		if (options.signal?.aborted) {
			errors.push({ url: item.url, reason: 'aborted', message: 'aborted' });
			return null;
		}
		const r = await fetchSitemapXml(axios, item.url, {
			timeoutMs,
			headers: options.headers,
			signal: options.signal,
		});
		if (!r.ok || !r.text) {
			errors.push({
				url: item.url,
				reason: r.reason ?? 'unknown',
				message: r.message,
			});
			return null;
		}
		return r.text;
	}

	while (queue.length > 0) {
		if (truncated) break;
		if (options.signal?.aborted) {
			truncated = true;
			break;
		}

		// Take a batch of pending sitemaps at current front depths
		const batch: QueueItem[] = [];
		while (queue.length > 0 && batch.length < concurrency) {
			const next = queue.shift()!;
			if (seenSitemaps.has(next.url) && !next.xml) continue;
			if (sitemapsVisited.length + batch.length >= maxSitemaps) {
				truncated = true;
				// put back so we don't lose accounting of remaining work
				queue.unshift(next);
				break;
			}
			if (!next.xml) seenSitemaps.add(next.url);
			batch.push(next);
		}
		if (batch.length === 0) break;

		const loaded = await mapPool(batch, concurrency, async (item) => {
			const xml = await loadXml(item);
			return { item, xml };
		});

		const childUrls: Array<{ url: string; depth: number }> = [];

		for (const { item, xml } of loaded) {
			if (!xml) continue;
			sitemapsVisited.push(item.url);
			const parsed = parseSitemapXml(xml);
			if (sitemapsVisited.length === 1 || rootKind == null) {
				rootKind = parsed.kind;
			}

			if (parsed.kind === 'sitemapindex' || parsed.sitemaps.length > 0) {
				if (item.depth >= maxDepth) {
					truncated = true;
					continue;
				}
				for (const child of parsed.sitemaps) {
					if (!child || seenSitemaps.has(child)) continue;
					childUrls.push({ url: child, depth: item.depth + 1 });
				}
			}

			// urlset pages (or mixed / unknown with locs)
			const entries =
				options.includeMetadata && parsed.urls.length
					? parsed.urls
					: parsed.locs.map((loc) => ({ loc }));

			for (const entry of entries.length ? entries : parsed.urls) {
				const loc = entry.loc;
				if (!loc || seenPages.has(loc)) continue;
				if (pageLocs.length >= maxUrls) {
					truncated = true;
					break;
				}
				seenPages.add(loc);
				pageLocs.push(loc);
				pageMeta.push(entry);
			}

			// If it looked like an index but also had locs (rare), already handled.
			// If unknown with only locs, handled via parsed.locs above.
			if (
				parsed.kind === 'urlset' ||
				(parsed.kind === 'unknown' && parsed.locs.length > 0)
			) {
				// done for this file
			}
		}

		for (const c of childUrls) {
			if (seenSitemaps.has(c.url)) continue;
			if (sitemapsVisited.length + queue.length >= maxSitemaps) {
				truncated = true;
				break;
			}
			queue.push(c);
		}
	}

	return {
		urls: includeMetadata ? pageMeta : pageLocs,
		sitemapsVisited,
		truncated,
		errors,
		kind: rootKind,
	};
}
