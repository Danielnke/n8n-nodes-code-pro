/**
 * n8n-like simulation: node class load, cold registry, mock execute, image pipeline.
 * Run: npm run build && node scripts/verify-n8n-sim.js
 */
const path = require('path');
const fs = require('fs');

async function main() {
	const reg = require(path.join(__dirname, '..', 'dist', 'src', 'libraryRegistry.js'));
	reg.clearLibraryCache();

	const t0 = Date.now();
	const { globals, availableList, loaded, failed } = reg.loadLibraryGlobals();
	const t1 = Date.now();
	console.log('cold loadLibraryGlobals ms', t1 - t0);
	console.log('registered', loaded.length, 'available', availableList.length, 'failed', failed.length);
	console.log(
		'utils APIs',
		typeof globals.utils.getAvailableLibraries,
		typeof globals.utils.getRegisteredLibraries,
		typeof globals.utils.getFailedLibraries,
		typeof globals.utils.isLibraryAvailable,
	);
	console.log('available includes Jimp?', availableList.includes('Jimp'));
	console.log('available includes web3?', availableList.includes('web3'));
	console.log('Jimp is getter?', typeof Object.getOwnPropertyDescriptor(globals, 'Jimp').get);
	console.log('lodash is value?', 'value' in Object.getOwnPropertyDescriptor(globals, '_'));
	console.log('web3 getter?', typeof Object.getOwnPropertyDescriptor(globals, 'web3').get);
	console.log('safeLoadFfprobePath', reg.safeLoadFfprobePath());
	console.log('safeLoadFfmpegPath', reg.safeLoadFfmpegPath());

	const { runUserCode } = require(path.join(__dirname, '..', 'dist', 'src', 'executeUserCode.js'));
	const {
		validateRunCodeAllItems,
		validateRunCodeEachItem,
	} = require(path.join(__dirname, '..', 'dist', 'src', 'resultValidation.js'));

	const mockCtx = {
		getWorkflowDataProxy: () => ({}),
		helpers: {
			normalizeItems: (x) => {
				const list = Array.isArray(x) ? x : [x];
				return list.map((i) => (i && i.json !== undefined ? i : { json: i }));
			},
		},
		getWorkflowStaticData: () => ({}),
		getNodeParameter: () => null,
		logger: {
			info: () => {},
			warn: (m) => console.log('WARN', m),
			error: () => {},
		},
	};

	const raw = await runUserCode({
		code: `
return [{
  json: {
    id: uuid.v4(),
    d: dayjs().year(),
    n: nanoid(),
    ok: _.get({ a: 1 }, 'a'),
    libs: utils.getAvailableLibraries().length,
    reg: utils.getRegisteredLibraries().length,
    jimpOk: utils.isLibraryAvailable('Jimp'),
  },
}];
`,
		items: [{ json: { hello: 1 } }],
		allItems: [{ json: { hello: 1 } }],
		itemIndex: 0,
		mode: 'runOnceForAllItems',
		timeoutSec: 15,
		ctx: mockCtx,
	});
	const v = validateRunCodeAllItems(raw, mockCtx.helpers.normalizeItems);
	console.log('mock execute', JSON.stringify(v));

	const raw2 = await runUserCode({
		code: `
const png = new PNG({ width: 8, height: 8 });
for (let i = 0; i < png.data.length; i += 4) {
  png.data[i] = 0; png.data[i + 1] = 128; png.data[i + 2] = 255; png.data[i + 3] = 255;
}
const buf = PNG.sync.write(png);
const img = await Jimp.read(buf);
img.resize(4, 4);
const out = await img.getBufferAsync(Jimp.MIME_PNG || 'image/png');
const size = imageSize(out);
return [{
  json: {
    w: size.width,
    h: size.height,
    bytes: out.length,
    hasFfmpeg: typeof ffmpeg === 'function',
    ffPath: typeof ffmpegStatic === 'string',
    probe: typeof ffprobeStatic === 'string',
  },
}];
`,
		items: [{ json: {} }],
		allItems: [{ json: {} }],
		itemIndex: 0,
		mode: 'runOnceForAllItems',
		timeoutSec: 30,
		ctx: mockCtx,
	});
	console.log('image pipeline', JSON.stringify(validateRunCodeAllItems(raw2, mockCtx.helpers.normalizeItems)));

	const raw3 = await runUserCode({
		code: `return { json: { ...($json || {}), v: 2, allLen: $input.all().length } };`,
		items: [{ json: { hello: 1 } }],
		allItems: [{ json: { hello: 1 } }, { json: { hello: 2 } }],
		itemIndex: 0,
		mode: 'runOnceForEachItem',
		timeoutSec: 10,
		ctx: mockCtx,
	});
	console.log(
		'each-item',
		JSON.stringify(validateRunCodeEachItem(raw3, 0, mockCtx.helpers.normalizeItems)),
	);

	const { CodePro } = require(path.join(__dirname, '..', 'dist', 'nodes', 'CodePro', 'CodePro.node.js'));
	const n = new CodePro();
	console.log('node', n.description.displayName, n.description.name, n.description.version);

	const must = [
		'dist/nodes/CodePro/CodePro.node.js',
		'dist/nodes/CodePro/codepro.png',
		'dist/src/libraryRegistry.js',
		'dist/src/executeUserCode.js',
	];
	for (const m of must) {
		const ok = fs.existsSync(path.join(__dirname, '..', m));
		console.log(m, ok ? 'OK' : 'MISSING');
		if (!ok) process.exitCode = 1;
	}

	console.log('\nALL VERIFY CHECKS DONE');
}

main().catch((e) => {
	console.error('VERIFY FAIL', e);
	process.exit(1);
});
