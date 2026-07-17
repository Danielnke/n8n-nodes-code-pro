/**
 * First-party helpers (utils global + version + sitemap).
 */

export { getCodeProVersion } from './version';
export { mapPool } from './mapPool';
export {
	createUtilsBag,
	type RetryOptions,
	type UtilsBagOptions,
} from './utilsBag';
export {
	createSitemapHelpers,
	parseSitemapXml,
	normalizeBase,
	looksLikeXml,
	detectKind,
	parseRobotsSitemaps,
	DEFAULT_SITEMAP_PATHS,
} from './sitemap';
