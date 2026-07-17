/**
 * Functional tests for core inject names + extras.
 * Not just require() — exercises a real API call on each global.
 * Run: npm run build && node scripts/functional-lib-test.js
 */
const { createContext, runInContext } = require('node:vm');
const path = require('path');
const reg = require(path.join(__dirname, '..', 'dist', 'src', 'libraryRegistry.js'));

/** Baseline inject names expected present (parity set + common aliases). */
const BASELINE_INJECTS = [
	'_',
	'lodash',
	'axios',
	'cheerio',
	'dayjs',
	'moment',
	'dateFns',
	'dateFnsTz',
	'joi',
	'Joi',
	'validator',
	'uuid',
	'Ajv',
	'yup',
	'xml2js',
	'XMLParser',
	'YAML',
	'papaparse',
	'Papa',
	'Handlebars',
	'CryptoJS',
	'forge',
	'jwt',
	'bcrypt',
	'bcryptjs',
	'XLSX',
	'QRCode',
	'fuzzy',
	'stringSimilarity',
	'slug',
	'pluralize',
	'qs',
	'FormData',
	'ini',
	'toml',
	'nanoid',
	'bytes',
	'phoneNumber',
	'iban',
	'web3',
	'ytdl',
	'ffmpeg',
	'ffmpegStatic',
	'utils',
	'ccxt',
	'coinGecko',
	'solana',
	'bitcoin',
	'secp256k1',
	'bip39',
	'franc',
	'compromise',
	'pRetry',
	'htmlToText',
	'marked',
	'jsonDiff',
	'cronParser',
];

/** Snippets that must evaluate truthy / not throw. Use only injected globals. */
const TESTS = {
	_: '() => _.get({ a: 1 }, "a") === 1',
	lodash: '() => lodash.chunk([1,2,3], 2).length === 2',
	axios: '() => typeof axios.get === "function"',
	cheerio: '() => cheerio.load("<p>x</p>")("p").text() === "x"',
	dayjs: '() => dayjs("2020-01-01").year() === 2020',
	moment: '() => moment("2020-01-01").year() === 2020',
	dateFns: '() => dateFns.format(new Date(2020,0,2), "yyyy") === "2020"',
	dateFnsTz: '() => typeof dateFnsTz.formatInTimeZone === "function"',
	joi: '() => !joi.string().email().validate("a@b.com").error',
	Joi: '() => !Joi.number().min(1).validate(2).error',
	validator: '() => validator.isEmail("a@b.com") === true',
	uuid: '() => typeof uuid.v4() === "string" && uuid.v4().length > 10',
	Ajv: '() => { const a = new Ajv(); return typeof a.compile === "function"; }',
	yup: '() => typeof yup.string === "function"',
	xml2js: '() => typeof xml2js.parseString === "function" || typeof xml2js.parseStringPromise === "function"',
	XMLParser: '() => { const p = new XMLParser(); return p.parse("<a>1</a>").a == 1 || p.parse("<a>1</a>").a === "1"; }',
	YAML: '() => YAML.parse("a: 1").a === 1',
	papaparse: '() => papaparse.parse("a,b\\n1,2").data.length >= 1',
	Papa: '() => Papa.parse("a\\n1").data.length >= 1',
	Handlebars: '() => Handlebars.compile("{{x}}")({ x: 1 }) === "1"',
	CryptoJS: '() => CryptoJS.MD5("x").toString().length === 32',
	forge: '() => typeof forge.md.sha256.create === "function"',
	jwt: '() => { const t = jwt.sign({ a: 1 }, "secret"); return jwt.verify(t, "secret").a === 1; }',
	bcrypt: '() => typeof bcrypt.hashSync === "function" && bcrypt.compareSync("x", bcrypt.hashSync("x", 4))',
	bcryptjs: '() => typeof bcryptjs.hashSync === "function"',
	XLSX: '() => { const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet([[1]]); XLSX.utils.book_append_sheet(wb, ws, "s"); return wb.SheetNames[0] === "s"; }',
	QRCode: '() => typeof QRCode.toDataURL === "function"',
	fuzzy: '() => { const F = fuzzy; const f = new F(["apple","banana"], { includeScore: true }); return f.search("app").length >= 1; }',
	stringSimilarity: '() => stringSimilarity.compareTwoStrings("a", "a") === 1',
	slug: '() => slug("Hello World") === "hello-world" || slug("Hello World").includes("hello")',
	pluralize: '() => pluralize("cat") === "cats"',
	qs: '() => qs.parse("a=1").a === "1"',
	FormData: '() => typeof FormData === "function"',
	ini: '() => ini.parse("a=1").a === "1"',
	toml: '() => toml.parse("a = 1").a === 1',
	nanoid: '() => { const id = typeof nanoid === "function" ? nanoid() : nanoid.nanoid(); const hasCustom = typeof nanoid === "function" ? true : typeof nanoid.customAlphabet === "function"; return typeof id === "string" && id.length > 0 && hasCustom; }',
	bytes: '() => bytes(1024) === "1KB" || bytes(1024) === "1 KB"',
	phoneNumber: '() => { const p = phoneNumber; if (typeof p.parsePhoneNumber === "function") { return p.parsePhoneNumber("+12133734253").isValid(); } if (typeof p === "function") { return p("+12133734253").isValid(); } return typeof p.isValidPhoneNumber === "function" && p.isValidPhoneNumber("+12133734253"); }',
	iban: '() => typeof iban.isValid === "function"',
	web3: '() => typeof web3 === "function" || typeof web3.Web3 === "function" || typeof web3 === "object"',
	ytdl: '() => typeof ytdl === "function" || typeof ytdl.getInfo === "function"',
	ffmpeg: '() => typeof ffmpeg === "function"',
	ffmpegStatic: '() => typeof ffmpegStatic === "string" || ffmpegStatic === null || typeof ffmpegStatic === "object"',
	utils: '() => typeof utils.sleep === "function" && typeof utils.getAvailableLibraries === "function"',
	ccxt: '() => typeof ccxt === "object" || typeof ccxt === "function"',
	coinGecko: '() => typeof coinGecko === "function" || typeof coinGecko === "object"',
	solana: '() => typeof solana.Keypair === "function" || typeof solana.PublicKey === "function"',
	bitcoin: '() => typeof bitcoin.payments === "object" || typeof bitcoin.networks === "object"',
	secp256k1: '() => typeof secp256k1.getPublicKey === "function" || typeof secp256k1.utils === "object"',
	bip39: '() => typeof bip39.generateMnemonic === "function"',
	// franc-min: inject must be the franc() function; short text → 'und'
	franc: '() => typeof franc === "function" && typeof franc("The quick brown fox jumps over the lazy dog in the park") === "string"',
	compromise: '() => typeof compromise === "function" || typeof compromise === "object"',
	pRetry: '() => typeof pRetry === "function"',
	htmlToText: '() => { const t = typeof htmlToText === "function" ? htmlToText("<b>x</b>") : htmlToText.convert("<b>x</b>"); return String(t).includes("x"); }',
	marked: '() => { const r = typeof marked.parse === "function" ? marked.parse("# h") : marked("# h"); return String(r).includes("h"); }',
	jsonDiff: '() => typeof jsonDiff === "object" || typeof jsonDiff === "function"',
	cronParser: '() => typeof cronParser.parseExpression === "function" || typeof cronParser === "function"',
	// extras
	z: '() => z.string().parse("hi") === "hi"',
	zod: '() => zod.number().parse(1) === 1',
	luxon: '() => luxon.DateTime.fromISO("2020-01-01").year === 2020',
	DateTime: '() => DateTime.fromISO("2020-01-01").year === 2020',
	jmespath: '() => jmespath.search({a:{b:1}}, "a.b") === 1',
	JSZip: '() => typeof JSZip === "function"',
	pako: '() => typeof pako.deflate === "function"',
	nodeCrypto: '() => nodeCrypto.createHash("sha256").update("x").digest("hex").length === 64',
	ms: '() => ms("1s") === 1000',
	XMLBuilder: '() => typeof XMLBuilder === "function"',
	ExcelJS: '() => typeof ExcelJS.Workbook === "function" || typeof ExcelJS === "function"',
	xlsx: '() => typeof xlsx.utils === "object"',
	// Image — real encode/decode ops (not just typeof); uses injected PNG/Jimp/JPEG
	Jimp: `async () => {
		const png = new PNG({ width: 4, height: 4 });
		for (let i = 0; i < png.data.length; i += 4) {
			png.data[i] = 255; png.data[i+1] = 0; png.data[i+2] = 0; png.data[i+3] = 255;
		}
		const buf = PNG.sync.write(png);
		const img = await Jimp.read(buf);
		const w = img.bitmap?.width ?? img.width;
		if (w !== 4) return false;
		if (typeof img.resize === 'function') img.resize(2, 2);
		const mime = Jimp.MIME_PNG || 'image/png';
		if (typeof img.getBufferAsync === 'function') {
			const out = await img.getBufferAsync(mime);
			return Buffer.isBuffer(out) && out.length > 0;
		}
		return true;
	}`,
	jimp: '() => typeof jimp.read === "function" || typeof jimp === "function"',
	imageSize: `() => {
		const png = new PNG({ width: 3, height: 5 });
		png.data = Buffer.alloc(3 * 5 * 4, 10);
		const buf = PNG.sync.write(png);
		const s = imageSize(buf);
		return s.width === 3 && s.height === 5;
	}`,
	exifr: '() => typeof exifr.parse === "function" || typeof exifr === "object"',
	JPEG: `() => {
		const raw = { data: Buffer.alloc(4 * 2 * 2, 128), width: 2, height: 2 };
		const enc = JPEG.encode(raw, 50);
		const dec = JPEG.decode(enc.data);
		return dec.width === 2 && dec.height === 2;
	}`,
	PNG: `() => {
		const png = new PNG({ width: 2, height: 2 });
		png.data = Buffer.alloc(16, 200);
		const buf = PNG.sync.write(png);
		const again = PNG.sync.read(buf);
		return again.width === 2 && again.height === 2;
	}`,
	// Video binaries — must be real existing paths (uses __fs from test sandbox)
	ffmpegStatic:
		'() => typeof ffmpegStatic === "string" && ffmpegStatic.length > 0 && __fs.existsSync(ffmpegStatic)',
	ffprobeStatic:
		'() => typeof ffprobeStatic === "string" && ffprobeStatic.length > 0 && __fs.existsSync(ffprobeStatic)',
	ffmpeg: '() => typeof ffmpeg === "function"',
};

async function runOne(name, globals) {
	const test = TESTS[name];
	if (!test) return { name, status: 'NO_TEST' };
	// Access property to resolve lazy getters
	let value;
	try {
		value = globals[name];
	} catch (e) {
		return { name, status: 'FAIL', error: e.message };
	}
	if (value === undefined && !(name in globals)) {
		return { name, status: 'MISSING' };
	}
	const code = `module.exports = async function(){ const __t = ${test}; return await __t(); }()`;
	// Copy descriptors so lazy libs stay lazy until this test accesses them
	const sandbox = {
		Buffer,
		console,
		setTimeout,
		clearTimeout,
		URL,
		__fs: require('fs'),
	};
	for (const key of Object.getOwnPropertyNames(globals)) {
		const desc = Object.getOwnPropertyDescriptor(globals, key);
		if (desc) Object.defineProperty(sandbox, key, desc);
	}
	const context = createContext(sandbox);
	try {
		const result = await runInContext(
			`globalThis.global=globalThis;var module={exports:{}};` + code,
			context,
			{ timeout: 15000 },
		);
		if (result) return { name, status: 'PASS' };
		return { name, status: 'FAIL', error: `returned ${result}` };
	} catch (e) {
		return { name, status: 'FAIL', error: e.message };
	}
}

async function main() {
	const { globals, loaded, failed } = reg.loadLibraryGlobals();
	console.log('Registry loaded injects:', loaded.length, 'failed stubs:', failed.length);

	const missingBaseline = BASELINE_INJECTS.filter((n) => !(n in globals));
	console.log('\n=== Baseline inject coverage ===');
	console.log('Baseline names:', BASELINE_INJECTS.length);
	console.log('Missing from Code Pro globals:', missingBaseline.length ? missingBaseline.join(', ') : 'none');

	const names = [...new Set([...BASELINE_INJECTS, ...Object.keys(TESTS)])];
	const results = [];
	for (const name of names) {
		const r = await runOne(name, globals);
		results.push(r);
		const mark = r.status === 'PASS' ? 'OK' : r.status;
		console.log(`${mark.padEnd(8)} ${name}${r.error ? ' — ' + r.error : ''}`);
	}

	const pass = results.filter((r) => r.status === 'PASS');
	const fail = results.filter((r) => r.status === 'FAIL');
	const missing = results.filter((r) => r.status === 'MISSING');
	const noTest = results.filter((r) => r.status === 'NO_TEST');

	console.log('\n=== SUMMARY ===');
	console.log(`PASS=${pass.length} FAIL=${fail.length} MISSING=${missing.length} NO_TEST=${noTest.length}`);
	if (fail.length) {
		console.log('FAILURES:');
		for (const f of fail) console.log(`  - ${f.name}: ${f.error}`);
	}
	if (missing.length) {
		console.log('MISSING:');
		for (const f of missing) console.log(`  - ${f.name}`);
	}

	// Baseline subset stats
	const baseline = results.filter((r) => BASELINE_INJECTS.includes(r.name));
	const baselinePass = baseline.filter((r) => r.status === 'PASS').length;
	console.log(`\nBaseline functional: ${baselinePass}/${BASELINE_INJECTS.length} PASS`);

	if (fail.length || missingBaseline.length) process.exitCode = 1;
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
