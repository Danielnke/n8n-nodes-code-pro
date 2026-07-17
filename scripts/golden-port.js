/**
 * Golden regression tests for mode / materialize / syntax.
 * NOT live n8n acceptance - see scripts/live-n8n-checklist.md
 *
 * Run: npm run build && npm run test:golden
 */
const path = require('path');
const { createContext, runInContext } = require('node:vm');

const root = path.join(__dirname, '..');
const {
	getLibraryGlobals,
	clearLibraryCache,
} = require(path.join(root, 'dist/src/libraryRegistry'));
const {
	runUserCode,
	installLibraryGlobalsOnSandbox,
	enhanceExecutionError,
} = require(path.join(root, 'dist/src/executeUserCode'));
const {
	validateRunCodeAllItems,
	validateRunCodeEachItem,
	CodeProValidationError,
} = require(path.join(root, 'dist/src/resultValidation'));
const { getCodeProVersion } = require(path.join(root, 'dist/src/utilsBag'));

let failed = 0;
function ok(name, cond, detail) {
	if (cond) {
		console.log('PASS', name, detail || '');
	} else {
		failed++;
		console.error('FAIL', name, detail || '');
	}
}

function mockCtx() {
	return {
		getWorkflowDataProxy: () => ({}),
		helpers: {
			normalizeItems: (x) => {
				const list = Array.isArray(x) ? x : [x];
				return list.map((i) =>
					i && typeof i === 'object' && ('json' in i || 'binary' in i)
						? i.json === undefined
							? { ...i, json: {} }
							: i
						: { json: i },
				);
			},
		},
		getWorkflowStaticData: () => ({}),
		getNodeParameter: () => null,
		logger: { info() {}, warn() {}, error() {} },
	};
}

async function main() {
	clearLibraryCache();
	const ctx = mockCtx();

	const ver = getCodeProVersion();
	ok('getCodeProVersion', /^\d+\.\d+\.\d+/.test(ver), ver);

	const { globals } = getLibraryGlobals();
	const sandbox = {};
	installLibraryGlobalsOnSandbox(sandbox, globals);
	const axiosDesc = Object.getOwnPropertyDescriptor(sandbox, 'axios');
	ok(
		'materialize axios eager data prop',
		axiosDesc && 'value' in axiosDesc && typeof axiosDesc.value === 'function',
		`get=${typeof axiosDesc?.get} value=${typeof axiosDesc?.value}`,
	);
	ok('axios.get', typeof sandbox.axios?.get === 'function');

	const web3Before = Object.getOwnPropertyDescriptor(sandbox, 'web3');
	ok('web3 starts as getter (lazy)', typeof web3Before?.get === 'function');
	const vm = createContext(sandbox);
	runInContext('void web3', vm);
	const web3After = Object.getOwnPropertyDescriptor(sandbox, 'web3');
	ok(
		'web3 materializes data prop on sandbox after access',
		web3After && 'value' in web3After && typeof web3After.get !== 'function',
		`get=${typeof web3After?.get} valueType=${typeof web3After?.value}`,
	);

	{
		const raw = await runUserCode({
			code: 'return [{ a: 1 }, { b: 2 }];',
			items: [{ json: {} }],
			allItems: [{ json: {} }],
			itemIndex: 0,
			mode: 'runOnceForAllItems',
			timeoutSec: 10,
			ctx,
		});
		const v = validateRunCodeAllItems(raw, ctx.helpers.normalizeItems);
		ok('all-items plain objects wrap', v.length === 2 && v[0].json.a === 1 && v[1].json.b === 2);
	}

	{
		const raw = await runUserCode({
			code: 'return [{ n: _.add(1,2), id: uuid.v4(), v: utils.getCodeProVersion() }];',
			items: [{ json: {} }],
			allItems: [{ json: {} }],
			itemIndex: 0,
			mode: 'runOnceForAllItems',
			timeoutSec: 10,
			ctx,
		});
		const v = validateRunCodeAllItems(raw, ctx.helpers.normalizeItems);
		ok(
			'core libs + version',
			v[0].json.n === 3 && typeof v[0].json.id === 'string' && typeof v[0].json.v === 'string',
			JSON.stringify(v[0].json),
		);
	}

	{
		const items = [{ json: { website: 'a.com' } }, { json: { website: 'b.com' } }];
		const raw = await runUserCode({
			code: 'const all = $input.all(); return all.map(i => ({ website: i.json.website, n: all.length }));',
			items: [items[0]],
			allItems: items,
			itemIndex: 0,
			mode: 'runOnceForEachItem',
			timeoutSec: 10,
			ctx,
		});
		let threw = null;
		try {
			validateRunCodeEachItem(raw, 0, ctx.helpers.normalizeItems);
		} catch (e) {
			threw = e;
		}
		ok(
			'each-item multi R1 error',
			threw instanceof CodeProValidationError &&
				/All Items/i.test(threw.description || threw.message) &&
				/multi-item|single object|All Items/i.test(threw.description || threw.message),
			threw ? threw.description || threw.message : 'no throw',
		);
		ok(
			'each-item $input.all is full list (stock)',
			Array.isArray(raw) && raw.length === 2 && raw[0].n === 2,
			JSON.stringify(raw),
		);
	}

	{
		let err;
		try {
			await runUserCode({
				code: 'output.push({ website: null, found: false',
				items: [{ json: {} }],
				allItems: [{ json: {} }],
				itemIndex: 0,
				mode: 'runOnceForAllItems',
				timeoutSec: 5,
				ctx,
			});
		} catch (e) {
			err = e;
		}
		const enhanced = enhanceExecutionError(err, 5);
		ok(
			'syntax error hint',
			/SyntaxError/i.test(enhanced.message) && /truncated|unmatched/i.test(enhanced.message),
			enhanced?.message?.slice(0, 120),
		);
	}

	if (process.env.CODE_PRO_SKIP_NETWORK === '1') {
		console.log('SKIP axios network (CODE_PRO_SKIP_NETWORK=1)');
	} else {
		try {
			const raw = await runUserCode({
				code: `const r = await axios.get('https://example.com', { timeout: 8000, responseType: 'text' });
return [{ status: r.status, len: String(r.data).length }];`,
				items: [{ json: {} }],
				allItems: [{ json: {} }],
				itemIndex: 0,
				mode: 'runOnceForAllItems',
				timeoutSec: 20,
				ctx,
			});
			ok('axios GET example.com', Array.isArray(raw) && raw[0].status === 200, JSON.stringify(raw));
		} catch (e) {
			console.log('SKIP axios network (error):', e.message?.slice(0, 100));
		}
	}

	clearLibraryCache();
	const cold = getLibraryGlobals();
	const web3Desc = Object.getOwnPropertyDescriptor(cold.globals, 'web3');
	ok('cold load web3 still getter', typeof web3Desc?.get === 'function');

	console.log(failed === 0 ? '\nALL GOLDEN PASS' : `\n${failed} GOLDEN FAIL(S)`);
	process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((e) => {
	console.error('GOLDEN CRASH', e);
	process.exit(1);
});
