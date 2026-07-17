/**
 * Discover and fetch a site's primary sitemap XML.
 */

import { mapPool } from '../mapPool';
import { detectKind } from './detect';
import { fetchSitemapXml, fetchText } from './http';
import { normalizeBase, resolveSitemapUrl } from './normalize';
import { DEFAULT_SITEMAP_PATHS } from './paths';
import { parseRobotsSitemaps } from './robots';
import type {
	AxiosLike,
	SitemapAttempt,
	SitemapFindOptions,
	SitemapFindResult,
} from './types';

async function tryCandidates(
	axios: AxiosLike,
	candidates: string[],
	options: SitemapFindOptions,
	attempts: SitemapAttempt[],
): Promise<{ sourceUrl: string; rawXml: string } | null> {
	const concurrency = options.concurrency ?? 4;
	const timeoutMs = options.timeoutMs ?? 8000;

	// Parallel probes but stop early once we have a winner (best-effort).
	// We still record all settled attempts for diagnostics.
	let winner: { sourceUrl: string; rawXml: string } | null = null;

	// Process in waves so we can short-circuit
	const waveSize = Math.max(1, concurrency);
	for (let i = 0; i < candidates.length; i += waveSize) {
		if (winner) break;
		if (options.signal?.aborted) break;
		const wave = candidates.slice(i, i + waveSize);
		const results = await mapPool(wave, wave.length, async (url) => {
			if (options.signal?.aborted) {
				return {
					url,
					ok: false as const,
					reason: 'aborted' as const,
					message: 'aborted',
					text: null as string | null,
					status: undefined as number | undefined,
				};
			}
			const r = await fetchSitemapXml(axios, url, {
				timeoutMs,
				headers: options.headers,
				signal: options.signal,
			});
			return r;
		});

		for (const r of results) {
			attempts.push({
				url: r.url,
				ok: r.ok,
				status: r.status,
				reason: r.reason,
				message: r.message,
			});
			if (r.ok && r.text && !winner) {
				winner = { sourceUrl: r.url, rawXml: r.text };
			}
		}
	}

	return winner;
}

/**
 * Find sitemap XML for a website via robots.txt + common paths.
 */
export async function findSitemap(
	axios: AxiosLike,
	website: string,
	options: SitemapFindOptions = {},
): Promise<SitemapFindResult> {
	const websiteStr = String(website ?? '').trim();
	const base = normalizeBase(websiteStr);
	const attempts: SitemapAttempt[] = [];
	const robotsSitemaps: string[] = [];

	if (!base) {
		return {
			website: websiteStr,
			base: '',
			found: false,
			sourceUrl: null,
			rawXml: null,
			kind: null,
			attempts: [
				{
					url: '',
					ok: false,
					reason: 'empty',
					message: 'No website / invalid URL',
				},
			],
			robotsSitemaps: [],
		};
	}

	// 1) robots.txt
	const robotsUrl = `${base}/robots.txt`;
	const robotsRes = await fetchText(axios, robotsUrl, {
		timeoutMs: options.timeoutMs ?? 8000,
		headers: options.headers,
		signal: options.signal,
	});
	attempts.push({
		url: robotsUrl,
		ok: !!robotsRes.ok && !!robotsRes.text,
		status: robotsRes.status,
		reason: robotsRes.ok
			? robotsRes.text
				? 'ok'
				: 'empty'
			: robotsRes.reason ?? 'network',
		message: robotsRes.message,
	});

	if (robotsRes.ok && robotsRes.text) {
		for (const s of parseRobotsSitemaps(robotsRes.text)) {
			const absolute = resolveSitemapUrl(base, s);
			if (absolute && !robotsSitemaps.includes(absolute)) {
				robotsSitemaps.push(absolute);
			}
		}
	}

	// 2) Candidate list: robots first, then paths
	const pathList = options.replacePaths
		? options.paths ?? []
		: [...DEFAULT_SITEMAP_PATHS, ...(options.paths ?? [])];

	const seen = new Set<string>();
	const candidates: string[] = [];
	const push = (u: string) => {
		if (!u || seen.has(u)) return;
		seen.add(u);
		candidates.push(u);
	};
	for (const s of robotsSitemaps) push(s);
	for (const p of pathList) {
		push(resolveSitemapUrl(base, p));
	}

	const winner = await tryCandidates(axios, candidates, options, attempts);

	if (!winner) {
		return {
			website: websiteStr,
			base,
			found: false,
			sourceUrl: null,
			rawXml: null,
			kind: null,
			attempts,
			robotsSitemaps,
		};
	}

	return {
		website: websiteStr,
		base,
		found: true,
		sourceUrl: winner.sourceUrl,
		rawXml: winner.rawXml,
		kind: detectKind(winner.rawXml),
		attempts,
		robotsSitemaps,
	};
}
