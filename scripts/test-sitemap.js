/**
 * Offline golden tests for utils.sitemap (no network).
 * Run: npm run build && npm run test:sitemap
 */
const path = require('path');
const zlib = require('zlib');
const root = path.join(__dirname, '..');

const {
	parseSitemapXml,
	normalizeBase,
	looksLikeXml,
	detectKind,
	parseRobotsSitemaps,
	createSitemapHelpers,
} = require(path.join(root, 'dist/src/utils/sitemap'));
const { mapPool } = require(path.join(root, 'dist/src/utils/mapPool'));
const {
	getLibraryGlobals,
	clearLibraryCache,
} = require(path.join(root, 'dist/src/libraryRegistry'));
const { runUserCode } = require(path.join(root, 'dist/src/executeUserCode'));
const { validateRunCodeAllItems } = require(path.join(root, 'dist/src/resultValidation'));

let failed = 0;
function ok(name, cond, detail) {
	if (cond) {
		console.log('PASS', name, detail || '');
	} else {
		failed++;
		console.error('FAIL', name, detail || '');
	}
}

const URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
  </url>
</urlset>`;

const INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-pages.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-posts.xml</loc>
  </sitemap>
</sitemapindex>`;

const CHILD_PAGES = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/p1</loc></url>
  <url><loc>https://example.com/p2</loc></url>
</urlset>`;

const CHILD_POSTS = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/a</loc></url>
  <url><loc>https://example.com/blog/b</loc></url>
  <url><loc>https://example.com/blog/c</loc></url>
</urlset>`;

/** Mock axios with in-memory routes */
function mockAxios(routes) {
	return {
		async get(url, config = {}) {
			if (config.signal?.aborted) {
				const err = new Error('canceled');
				err.code = 'ERR_CANCELED';
				err.name = 'CanceledError';
				throw err;
			}
			const hit = routes[url];
			if (!hit) {
				const err = new Error(`Request failed with status code 404: ${url}`);
				err.response = { status: 404 };
				throw err;
			}
			if (hit.throw) {
				const err = new Error(hit.throw.message || 'error');
				Object.assign(err, hit.throw);
				throw err;
			}
			return {
				status: hit.status ?? 200,
				data: hit.data,
				headers: hit.headers ?? { 'content-type': 'application/xml' },
			};
		},
	};
}

async function main() {
	// --- pure helpers ---
	ok('normalizeBase example.com', normalizeBase('example.com') === 'https://example.com');
	ok(
		'normalizeBase strips path',
		normalizeBase('https://example.com/foo/bar') === 'https://example.com',
	);
	ok('looksLikeXml urlset', looksLikeXml(URLSET) === true);
	ok('looksLikeXml html false', looksLikeXml('<!DOCTYPE html><html></html>') === false);
	ok('detectKind urlset', detectKind(URLSET) === 'urlset');
	ok('detectKind index', detectKind(INDEX) === 'sitemapindex');

	const robots = parseRobotsSitemaps(`
User-agent: *
Disallow: /admin
Sitemap: https://example.com/sitemap.xml
Sitemap: https://cdn.example.com/news-sitemap.xml
# Sitemap: https://ignored.example.com/x.xml
`);
	ok(
		'robots multi Sitemap',
		robots.length === 2 &&
			robots[0] === 'https://example.com/sitemap.xml' &&
			robots[1] === 'https://cdn.example.com/news-sitemap.xml',
		JSON.stringify(robots),
	);

	const parsed = parseSitemapXml(URLSET);
	ok(
		'parse urlset locs',
		parsed.kind === 'urlset' &&
			parsed.locs.length === 2 &&
			parsed.locs[0] === 'https://example.com/' &&
			parsed.urls[0].lastmod === '2024-01-01',
		JSON.stringify(parsed),
	);

	const idx = parseSitemapXml(INDEX);
	ok(
		'parse sitemapindex',
		idx.kind === 'sitemapindex' &&
			idx.sitemaps.length === 2 &&
			idx.sitemaps[0].includes('sitemap-pages'),
		JSON.stringify(idx),
	);

	const pool = await mapPool([1, 2, 3, 4], 2, async (n) => n * 10);
	ok('mapPool order', pool.join(',') === '10,20,30,40', JSON.stringify(pool));

	// --- mock HTTP find / expand ---
	const routes = {
		'https://example.com/robots.txt': {
			data: 'Sitemap: https://example.com/sitemap_index.xml\n',
			headers: { 'content-type': 'text/plain' },
		},
		'https://example.com/sitemap_index.xml': { data: INDEX },
		'https://example.com/sitemap-pages.xml': { data: CHILD_PAGES },
		'https://example.com/sitemap-posts.xml': { data: CHILD_POSTS },
		'https://example.com/sitemap.xml': {
			data: '<!DOCTYPE html><html>nope</html>',
			headers: { 'content-type': 'text/html' },
		},
	};

	// gzip child
	const gzXml = zlib.gzipSync(Buffer.from(CHILD_PAGES, 'utf8'));
	routes['https://example.com/pages.xml.gz'] = {
		data: gzXml,
		headers: { 'content-type': 'application/gzip' },
	};

	const axios = mockAxios(routes);
	const sitemap = createSitemapHelpers({ getAxios: () => axios });

	const found = await sitemap.find('example.com', { concurrency: 4, timeoutMs: 2000 });
	ok(
		'find via robots',
		found.found === true &&
			found.sourceUrl === 'https://example.com/sitemap_index.xml' &&
			found.kind === 'sitemapindex' &&
			found.robotsSitemaps.length === 1,
		JSON.stringify({
			found: found.found,
			sourceUrl: found.sourceUrl,
			kind: found.kind,
			robots: found.robotsSitemaps,
			attempts: found.attempts.length,
		}),
	);

	const expanded = await sitemap.expand(found.rawXml, {
		isXml: true,
		sourceUrl: found.sourceUrl,
		maxUrls: 100,
		concurrency: 2,
	});
	// expand from raw index still needs network for children
	ok(
		'expand index → 5 page urls',
		Array.isArray(expanded.urls) &&
			expanded.urls.length === 5 &&
			expanded.sitemapsVisited.length >= 1 &&
			expanded.truncated === false,
		JSON.stringify(expanded),
	);

	const meta = await sitemap.expand('https://example.com/sitemap-pages.xml', {
		includeMetadata: true,
	});
	ok(
		'expand includeMetadata',
		Array.isArray(meta.urls) &&
			meta.urls.length === 2 &&
			typeof meta.urls[0] === 'object' &&
			meta.urls[0].loc === 'https://example.com/p1',
		JSON.stringify(meta.urls),
	);

	const gz = await sitemap.expand('https://example.com/pages.xml.gz');
	ok(
		'expand gzip url',
		Array.isArray(gz.urls) && gz.urls.length === 2 && gz.urls.includes('https://example.com/p1'),
		JSON.stringify(gz),
	);

	const oneShot = await sitemap.fromWebsite('example.com', {
		expand: true,
		maxUrls: 100,
	});
	ok(
		'fromWebsite expand',
		oneShot.found &&
			Array.isArray(oneShot.urls) &&
			oneShot.urls.length === 5 &&
			oneShot.rawXml === null,
		JSON.stringify({ found: oneShot.found, n: oneShot.urls?.length, raw: oneShot.rawXml }),
	);

	const batch = await sitemap.fromWebsites(['example.com', ''], {
		websiteConcurrency: 2,
		expand: false,
	});
	ok(
		'fromWebsites batch',
		batch.length === 2 && batch[0].found === true && batch[1].found === false,
		JSON.stringify(batch.map((b) => ({ w: b.website, f: b.found }))),
	);

	// HTML not_xml diagnostic
	const badAxios = mockAxios({
		'https://nositemap.test/robots.txt': {
			throw: { message: 'Request failed', response: { status: 404 } },
		},
		'https://nositemap.test/sitemap.xml': {
			data: '<!DOCTYPE html><html>Soft 404</html>',
			headers: { 'content-type': 'text/html' },
		},
	});
	const badHelpers = createSitemapHelpers({ getAxios: () => badAxios });
	const miss = await badHelpers.find('https://nositemap.test', {
		paths: ['/sitemap.xml'],
		replacePaths: true,
		concurrency: 2,
	});
	ok(
		'find diagnostics not_xml',
		miss.found === false &&
			miss.attempts.some((a) => a.reason === 'not_xml' || a.reason === 'http_error'),
		JSON.stringify(miss.attempts),
	);

	// --- live in sandbox via utils.sitemap ---
	clearLibraryCache();
	const { globals } = getLibraryGlobals();
	ok(
		'utils.sitemap present',
		globals.utils &&
			typeof globals.utils.sitemap?.find === 'function' &&
			typeof globals.utils.sitemap?.parse === 'function' &&
			typeof globals.utils.mapPool === 'function',
	);

	const parsedInSandbox = globals.utils.sitemap.parse(URLSET);
	ok(
		'utils.sitemap.parse via registry',
		parsedInSandbox.locs?.length === 2,
		JSON.stringify(parsedInSandbox.locs),
	);

	const mockCtx = {
		getWorkflowDataProxy: () => ({}),
		helpers: {
			normalizeItems: (x) => {
				const list = Array.isArray(x) ? x : [x];
				return list.map((i) =>
					i && typeof i === 'object' && ('json' in i || 'binary' in i)
						? i
						: { json: i },
				);
			},
		},
		getWorkflowStaticData: () => ({}),
		getNodeParameter: () => null,
		logger: { info() {}, warn() {}, error() {} },
	};

	const raw = await runUserCode({
		code: `
const xml = ${JSON.stringify(URLSET)};
const p = utils.sitemap.parse(xml);
return [{ kind: p.kind, n: p.locs.length, first: p.locs[0] }];
`,
		items: [{ json: {} }],
		allItems: [{ json: {} }],
		itemIndex: 0,
		mode: 'runOnceForAllItems',
		timeoutSec: 10,
		ctx: mockCtx,
	});
	const v = validateRunCodeAllItems(raw, mockCtx.helpers.normalizeItems);
	ok(
		'runUserCode utils.sitemap.parse',
		v[0].json.kind === 'urlset' && v[0].json.n === 2,
		JSON.stringify(v[0].json),
	);

	console.log(failed === 0 ? '\nALL SITEMAP TESTS PASS' : `\n${failed} SITEMAP FAIL(S)`);
	process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((e) => {
	console.error('SITEMAP TEST CRASH', e);
	process.exit(1);
});
