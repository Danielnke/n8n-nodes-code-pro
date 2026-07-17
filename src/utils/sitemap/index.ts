/**
 * Public utils.sitemap API — discover, parse, expand sitemap XML.
 */

import { mapPool } from '../mapPool';
import { findSitemap } from './discover';
import { expandSitemap } from './expand';
import { detectKind, looksLikeXml } from './detect';
import { normalizeBase } from './normalize';
import { parseSitemapXml } from './parse';
import { parseRobotsSitemaps } from './robots';
import { DEFAULT_SITEMAP_PATHS } from './paths';
import type {
	AxiosLike,
	SitemapExpandOptions,
	SitemapFindOptions,
	SitemapFromWebsiteOptions,
	SitemapFromWebsiteResult,
	SitemapFromWebsitesOptions,
	SitemapHelpersDeps,
} from './types';

export type {
	SitemapKind,
	SitemapAttempt,
	SitemapUrlEntry,
	SitemapParseResult,
	SitemapFindOptions,
	SitemapFindResult,
	SitemapExpandOptions,
	SitemapExpandResult,
	SitemapFromWebsiteOptions,
	SitemapFromWebsiteResult,
	SitemapFromWebsitesOptions,
	AxiosLike,
	SitemapHelpersDeps,
} from './types';

export { normalizeBase } from './normalize';
export { looksLikeXml, detectKind } from './detect';
export { parseSitemapXml } from './parse';
export { parseRobotsSitemaps } from './robots';
export { DEFAULT_SITEMAP_PATHS } from './paths';

function resolveAxios(getAxios: () => AxiosLike): AxiosLike {
	const ax = getAxios();
	if (!ax || typeof ax.get !== 'function') {
		throw new Error(
			'utils.sitemap requires axios (HTTP client). Ensure axios is available in Code Pro.',
		);
	}
	return ax;
}

/**
 * Build the `utils.sitemap` object attached to the utils bag.
 */
export function createSitemapHelpers(deps: SitemapHelpersDeps): Record<string, unknown> {
	const { getAxios } = deps;

	async function find(website: string, options?: SitemapFindOptions) {
		return findSitemap(resolveAxios(getAxios), website, options);
	}

	function parse(rawXml: string) {
		return parseSitemapXml(rawXml);
	}

	async function expand(
		sourceUrlOrXml: string,
		options?: SitemapExpandOptions & { isXml?: boolean; sourceUrl?: string },
	) {
		const opts = options ?? {};
		const isXml =
			opts.isXml === true ||
			(opts.isXml !== false && looksLikeXml(sourceUrlOrXml) && !/^https?:\/\//i.test(sourceUrlOrXml.trim()));
		return expandSitemap(
			resolveAxios(getAxios),
			{
				source: sourceUrlOrXml,
				isXml,
				sourceUrl: opts.sourceUrl,
			},
			opts,
		);
	}

	async function fromWebsite(
		website: string,
		options: SitemapFromWebsiteOptions = {},
	): Promise<SitemapFromWebsiteResult> {
		const found = await findSitemap(resolveAxios(getAxios), website, options);
		// Drop rawXml when expanding unless caller asks (keeps n8n payloads small)
		const includeRawXml = options.includeRawXml ?? !options.expand;
		const baseResult: SitemapFromWebsiteResult = {
			...found,
			rawXml: includeRawXml ? found.rawXml : null,
		};

		if (!options.expand || !found.found) {
			return {
				...baseResult,
				urls: options.expand ? [] : undefined,
				sitemapsVisited: options.expand ? [] : undefined,
				truncated: options.expand ? false : undefined,
				errors: options.expand ? [] : undefined,
			};
		}

		const expanded = await expandSitemap(
			resolveAxios(getAxios),
			{
				source: found.rawXml!,
				isXml: true,
				sourceUrl: found.sourceUrl ?? undefined,
			},
			options,
		);

		return {
			...baseResult,
			kind: expanded.kind ?? found.kind,
			urls: expanded.urls,
			sitemapsVisited: expanded.sitemapsVisited,
			truncated: expanded.truncated,
			errors: expanded.errors,
		};
	}

	async function fromWebsites(
		websites: Array<string | null | undefined>,
		options: SitemapFromWebsitesOptions = {},
	): Promise<SitemapFromWebsiteResult[]> {
		const list = (websites ?? []).map((w) => String(w ?? '').trim());
		const websiteConcurrency = options.websiteConcurrency ?? options.concurrency ?? 3;
		// Per-site discovery concurrency is separate
		const siteOpts: SitemapFromWebsiteOptions = { ...options };
		return mapPool(list, websiteConcurrency, async (site) => {
			if (!site) {
				return {
					website: '',
					base: '',
					found: false,
					sourceUrl: null,
					rawXml: null,
					kind: null,
					attempts: [
						{ url: '', ok: false, reason: 'empty' as const, message: 'Empty website' },
					],
					robotsSitemaps: [],
					urls: options.expand ? [] : undefined,
					sitemapsVisited: options.expand ? [] : undefined,
					truncated: options.expand ? false : undefined,
					errors: options.expand ? [] : undefined,
				};
			}
			return fromWebsite(site, siteOpts);
		});
	}

	return {
		find,
		parse,
		expand,
		fromWebsite,
		fromWebsites,
		/** Normalize a website to origin base URL. */
		normalizeBase,
		/** Detect if text looks like sitemap XML. */
		looksLikeXml,
		/** Detect urlset vs sitemapindex. */
		detectKind,
		/** Parse robots.txt Sitemap: lines. */
		parseRobotsSitemaps,
		/** Default discovery paths (readonly copy). */
		DEFAULT_PATHS: [...DEFAULT_SITEMAP_PATHS],
	};
}
