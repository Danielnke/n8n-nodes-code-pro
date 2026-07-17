/**
 * Reproduce SuperCode "Fetch Sitemap XML" under Code Pro executor.
 */
const { runUserCode } = require('../dist/src/executeUserCode');
const {
	validateRunCodeAllItems,
	validateRunCodeEachItem,
	CodeProValidationError,
} = require('../dist/src/resultValidation');

const code = `// SuperCode Node: "Fetch Sitemap XML"
const FETCH_TIMEOUT = 8000;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept': 'application/xml,text/xml,*/*',
};

const COMMON_SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/sitemapindex.xml',
  '/wp-sitemap.xml',
  '/sitemap1.xml',
  '/page-sitemap.xml',
  '/post-sitemap.xml',
];

function normalizeBase(url) {
  let u = String(url || '').trim();
  if (!u) return '';
  if (!/^https?:\\/\\//i.test(u)) u = 'https://' + u;
  u = u.replace(/\\/+$/, '');
  return u;
}

function looksLikeXml(text) {
  if (!text || typeof text !== 'string') return false;
  const head = text.trim().slice(0, 200).toLowerCase();
  return head.startsWith('<?xml') || head.includes('<urlset') || head.includes('<sitemapindex');
}

async function tryFetchXml(url) {
  try {
    const res = await axios.get(url, {
      timeout: FETCH_TIMEOUT,
      headers: BROWSER_HEADERS,
      responseType: 'text',
      validateStatus: (s) => s < 400,
    });
    return looksLikeXml(res.data) ? res.data : null;
  } catch (err) {
    return null;
  }
}

async function findSitemapUrlFromRobots(base) {
  try {
    const res = await axios.get(base + '/robots.txt', { timeout: FETCH_TIMEOUT, headers: BROWSER_HEADERS });
    const lines = String(res.data).split('\\n');
    const sitemapLine = lines.find((l) => l.toLowerCase().startsWith('sitemap:'));
    if (sitemapLine) return sitemapLine.split(':').slice(1).join(':').trim();
  } catch (err) {
  }
  return null;
}

const inputItems = (typeof $input !== 'undefined' && $input.all) ? $input.all() : (typeof items !== 'undefined' ? items : [item]);
const output = [];

for (const inputItem of inputItems) {
  const website = (inputItem.json && (inputItem.json.Website || inputItem.json.website)) || inputItem.Website || inputItem.website;
  if (!website) {
    output.push({ website: null, sourceUrl: null, rawXml: null, found: false, error: 'No website field on input item' });
    continue;
  }

  const base = normalizeBase(website);
  let rawXml = null;
  let sourceUrl = null;

  const robotsSitemap = await findSitemapUrlFromRobots(base);
  if (robotsSitemap) {
    const xml = await tryFetchXml(robotsSitemap);
    if (xml) { rawXml = xml; sourceUrl = robotsSitemap; }
  }

  if (!rawXml) {
    for (const path of COMMON_SITEMAP_PATHS) {
      const candidate = base + path;
      const xml = await tryFetchXml(candidate);
      if (xml) { rawXml = xml; sourceUrl = candidate; break; }
    }
  }

  output.push({ website, sourceUrl, rawXml, found: !!rawXml });
}

return output;
`;

function makeNormalize(label) {
	return (x) => {
		const list = Array.isArray(x) ? x : [x];
		return list.map((i) => {
			if (i && typeof i === 'object' && ('json' in i || 'binary' in i)) {
				return i.json === undefined ? { ...i, json: {} } : i;
			}
			return { json: i };
		});
	};
}

// Some n8n versions of normalizeItems may NOT wrap plain objects
function strictN8nLikeNormalize(x) {
	const list = Array.isArray(x) ? x : [x];
	return list.map((i) => {
		// Fail if plain object without json - mimic older/stricter path
		if (!i || typeof i !== 'object') throw new Error('bad item');
		if (!('json' in i)) {
			// Stock Code actually wraps - but let's see
			return { json: i };
		}
		return i;
	});
}

async function main() {
	const items = [{ json: { website: 'example.com' } }];
	const mockCtx = {
		getWorkflowDataProxy: () => ({}),
		helpers: { normalizeItems: makeNormalize('default') },
		getWorkflowStaticData: () => ({}),
		getNodeParameter: () => null,
		logger: {
			info: (...a) => console.log('[info]', ...a),
			warn: (...a) => console.log('[warn]', ...a),
			error: (...a) => console.log('[error]', ...a),
		},
	};

	console.log('=== runOnceForAllItems ===');
	try {
		const raw = await runUserCode({
			code,
			items,
			allItems: items,
			itemIndex: 0,
			mode: 'runOnceForAllItems',
			timeoutSec: 60,
			ctx: mockCtx,
		});
		console.log('raw type', Array.isArray(raw) ? 'array' : typeof raw, 'len', Array.isArray(raw) ? raw.length : null);
		console.log('raw[0] keys', raw && raw[0] ? Object.keys(raw[0]) : null);
		const v = validateRunCodeAllItems(raw, mockCtx.helpers.normalizeItems);
		console.log(
			'validated OK',
			JSON.stringify(v.map((i) => ({ found: i.json.found, sourceUrl: i.json.sourceUrl, xmlLen: i.json.rawXml ? String(i.json.rawXml).length : 0 }))),
		);
	} catch (e) {
		console.error('ALL-ITEMS FAIL', e.message);
		if (e.description) console.error('description', e.description);
		console.error(e.stack);
	}

	console.log('\n=== runOnceForEachItem (common SuperCode default mismatch) ===');
	try {
		const raw = await runUserCode({
			code,
			items: [items[0]],
			allItems: items,
			itemIndex: 0,
			mode: 'runOnceForEachItem',
			timeoutSec: 60,
			ctx: mockCtx,
		});
		console.log('each raw type', Array.isArray(raw) ? 'array' : typeof raw);
		const v = validateRunCodeEachItem(raw, 0, mockCtx.helpers.normalizeItems);
		console.log('each OK', JSON.stringify(v));
	} catch (e) {
		console.error('EACH-ITEM FAIL', e.message);
		if (e.description) console.error('description', e.description);
	}

	// axios shape check
	const reg = require('../dist/src/libraryRegistry');
	reg.clearLibraryCache();
	const g = reg.loadLibraryGlobals().globals;
	console.log('\n=== axios inject ===');
	console.log('typeof axios', typeof g.axios);
	console.log('typeof axios.get', typeof g.axios?.get);
	console.log('defaultExport shape keys', g.axios && Object.keys(g.axios).slice(0, 10));
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
