import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import {
	coerceTimeoutSec,
	getTimeoutErrorMeta,
	isTimeoutError,
	MAX_SOFT_TIMEOUT_SEC,
	runUserCode,
	type CodeProMode,
} from '../../src/execution';
import {
	CodeProValidationError,
	coerceMaxOutputItems,
	enforceMaxOutputItemCount,
	enforceMaxOutputItems,
	isMaxOutputItemsError,
	maybeAddPairedItemHint,
	validateRunCodeAllItems,
	validateRunCodeEachItem,
} from '../../src/validation';

import {
	coercePythonLogKiB,
	coercePythonProtocolMiB,
	isPythonRunnerError,
	logPythonOutput,
	PythonRuntimeUnavailableError,
	runPythonCode,
} from '../../src/python';

/**
 * Default editor template â€” AI/human capability card.
 * Full inject inventory, I/O contract, idioms, and pitfalls so models write
 * correct Code Pro scripts without inventing missing libs.
 * ASCII comments only; no nested template-literal backticks or ${} in the body.
 */
const DEFAULT_JS = `// =============================================================================
// CODE PRO â€” AI / AUTHOR GUIDE (read before writing script)
// Self-hosted n8n community node: JavaScript + 74 library globals in-process.
// No NODE_FUNCTION_ALLOW_EXTERNAL. Heavy libs load on first use (lazy).
// Runtime: utils.getCodeProVersion() | utils.getRegisteredLibraries()
//          utils.getAvailableLibraries() | utils.getFailedLibraries()
//          utils.isLibraryAvailable('axios')
// =============================================================================
//
// ### n8n I/O CONTRACT (critical)
// MODE
//   - runOnceForAllItems: code runs once; return an ARRAY of items.
//   - runOnceForEachItem: code runs per input; return ONE object (or 1-el array).
//     Returning N>1 items in each-item mode FAILS â€” switch to All Items.
// INPUT HELPERS (stock Code-compatible)
//   $input.all()     -> full input item list in BOTH modes (not shrunk to current)
//   $input.first()   -> first item
//   $input.item      -> current item (each-item mode)
//   $json -> current item json; item -> current full item (each-item only)
//   $itemIndex       -> current index (each-item)
// RETURN SHAPE
//   Prefer: return [{ json: { ... }, pairedItem: { item: index } }, ...]
//   Plain objects { a: 1 } auto-wrap to { json: { a: 1 } } in All Items.
//   Keep business data under json; set pairedItem when counts differ.
// OPTIONS
//   Timeout: 0 = unlimited (wait until code returns; SuperCode-like for long HTTP).
//            >0 = soft Promise.race + AbortSignal (utils.sitemap HTTP cancels on timeout).
//   Max Output Items (default 10000): fail-closed if you return more (expand carefully).
// DEBUG: console.log(...); errors surface as NodeOperationError with hints.
//
// ### FULL INJECT NAME LIST (use ONLY these globals â€” do not invent packages)
// _, lodash, bytes, ms, qs, uuid, nanoid, utils, dayjs, moment, dateFns, dateFnsTz,
// luxon, DateTime, cronParser, joi, Joi, yup, z, zod, Ajv, validator, phoneNumber, iban,
// papaparse, Papa, xml2js, XMLParser, XMLBuilder, YAML, ini, toml, jmespath, jsonDiff,
// cheerio, htmlToText, marked, Handlebars, slug, pluralize, fuzzy, stringSimilarity,
// franc, compromise, CryptoJS, nodeCrypto, forge, jwt, bcrypt, bcryptjs, secp256k1, bip39,
// axios, FormData, pRetry, ExcelJS, JSZip, pako, QRCode, Jimp, jimp, JimpMime, imageSize,
// exifr, JPEG, PNG, ffmpeg, ffmpegStatic, web3, ccxt, coinGecko, solana,
// bitcoin, ytdl
// First-party on utils: sitemap.*, mapPool, sleep, retry, flatten, isEmail, isUrl,
//   sanitizeInput (basic cleanup only, NOT XSS protection), getCodeProVersion,
//   getFailedLibraries, isLibraryAvailable, memoryUsage
//
// ### CAPABILITY MAP â€” what you can do (with idioms)
//
// DATA / IDs
//   _.get(obj,'a.b')  _.groupBy(rows,'type')  _.uniqBy(rows,'id')  _.merge({},a,b)
//   lodash === _ (alias). bytes('1.5mb')  ms('5m')  qs.parse / qs.stringify
//   uuid.v4()  nanoid()  utils.flatten(obj)  utils.isEmail(s)  utils.isUrl(s)
//   await utils.sleep(500)  await utils.retry(fn, { attempts: 3, delay: 1000 })
//   await utils.mapPool(items, 4, async (x, i) => ...)  // order-preserving concurrency
//
// DATES
//   dayjs().toISOString()  dayjs(x).format('YYYY-MM-DD')  dayjs(x).add(1,'day')
//   moment.tz(date, 'America/New_York')  dateFns.format / parseISO / differenceInDays
//   DateTime.now().toISO()  luxon.DateTime.fromISO(...)  cronParser.parseExpression(expr)
//
// VALIDATION
//   z.object({ email: z.string().email() }).parse(row)
//   joi.object({ n: joi.number().required() }).validate(row)
//   yup.string().url().validateSync(u)  new Ajv().compile(schema)
//   validator.isEmail(s)  phoneNumber.parsePhoneNumber(s,'US')  iban.isValid(s)
//
// PARSE / SERIALIZE
//   Papa.parse(csvText, { header: true }).data   Papa.unparse(rows)
//   new XMLParser().parse(xmlString)   new XMLBuilder().build(obj)
//   YAML.parse / YAML.stringify   ini.parse / toml.parse
//   jmespath.search(data, 'items[*].id')   jsonDiff.diff(a,b)
//
// HTML / TEXT / NLP
//   cheerio.load(html)('a').map((i,el) => $(el).attr('href')).get()
//   htmlToText(html)  marked.parse(md)  Handlebars.compile(tpl)(ctx)
//   slug('Hello World')  pluralize('item', 2)  franc(text)  compromise(text).topics()
//   new fuzzy(list, { keys: ['name'] }).search(q)  stringSimilarity.compareTwoStrings(a,b)
//
// CRYPTO / AUTH
//   CryptoJS.SHA256(s).toString()  CryptoJS.AES.encrypt / decrypt
//   nodeCrypto.createHash('sha256').update(s).digest('hex')
//   jwt.sign(payload, secret)  jwt.verify(token, secret)
//   await bcrypt.hash(pw, 10)  await bcrypt.compare(pw, hash)
//   forge / secp256k1 / bip39 for advanced crypto / wallets
//
// HTTP
//   const r = await axios.get(url, { timeout: 8000, responseType: 'text', headers: {...} });
//   await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } })
//   await pRetry(() => axios.get(url), { retries: 3 })
//   Prefer utils.mapPool for many URLs instead of unbounded Promise.all.
//
// SITEMAPS (first-party â€” prefer over hand-rolled axios loops)
//   const r = await utils.sitemap.find(website)  // robots + common paths, diagnostics
//   // r: { found, sourceUrl, rawXml, kind, robotsSitemaps, attempts[] }
//   utils.sitemap.parse(rawXml)  // { kind, locs, sitemaps, urls }
//   await utils.sitemap.expand(sourceUrlOrXml, { maxDepth: 3, maxSitemaps: 50, maxUrls: 10000 })
//   await utils.sitemap.fromWebsite(website, { expand: true, maxUrls: 5000 })
//   await utils.sitemap.fromWebsites(list, { websiteConcurrency: 3, expand: false })
//   Expand is OPT-IN. urls are strings unless includeMetadata: true.
//   found:false -> inspect attempts[].reason (not_xml, http_error, timeout, network, ...)
//   Drop huge rawXml when expanding (default). Watch Max Output Items on URL fan-out.
//
// SPREADSHEETS / ARCHIVES / QR
//   const workbook = new ExcelJS.Workbook(); workbook.addWorksheet('Data')
//   JSZip / pako  await QRCode.toDataURL(text)
//
// IMAGE / VIDEO
//   const img = await Jimp.read(bufOrUrl); img.resize({ w: 200 });
//   const out = await img.getBuffer(JimpMime.png);
//   imageSize(buf)  await exifr.parse(buf)  JPEG / PNG low-level encode/decode
//   ffmpeg(input).output(out).on('end', ...).run()
//   Bundled path: ffmpegStatic. Install system ffprobe when metadata probing is needed.
//
// BLOCKCHAIN / TRADING / YT (heavy â€” only when needed)
//   web3  ccxt  coinGecko  solana  bitcoin  ytdl
//
// ### AI AUTHORING RULES
// 1. Use listed globals only. Prefer global axios â€” do not invent missing npm names.
// 2. Multi-site / multi-output -> Mode All Items. Never return N items from each-item.
// 3. Prefer utils.sitemap.* for sitemaps; utils.mapPool for concurrency limits.
// 4. Handle HTTP failures; put diagnostics on the item (do not silent-empty without fields).
// 5. Cap expands (maxUrls); respect Max Output Items. Timeout 0 = unlimited for long sitemaps.
// 6. Put fields under json; set pairedItem when input/output counts differ.
// 7. Keep scripts complete (no truncated braces) â€” incomplete paste -> SyntaxError.
// 8. Prefer dayjs / uuid / _ for light transforms; load heavy libs only when required.
// 9. Do not assume $input.all() shrinks in each-item mode â€” it is the FULL list (stock).
//
// ### RECIPE SNIPPETS (copy patterns, then delete unused)
// // HTTP one URL
// // const res = await axios.get(String($json.url), { timeout: 10000, responseType: 'text' });
// // return [{ json: { status: res.status, body: String(res.data).slice(0, 500) } }];
//
// // Sitemap -> one item per site
// // const sites = $input.all().map(i => i.json.website || i.json.Website);
// // const out = await utils.sitemap.fromWebsites(sites, { expand: false, websiteConcurrency: 3 });
// // return out.map((r, index) => ({ json: r, pairedItem: { item: index } }));
//
// // Sitemap -> one item per page URL
// // const r = await utils.sitemap.fromWebsite($json.website, { expand: true, maxUrls: 5000 });
// // if (!r.found) return [{ json: { found: false, attempts: r.attempts } }];
// // return r.urls.map(loc => ({ json: { loc, sourceUrl: r.sourceUrl, truncated: r.truncated } }));
//
// // Validate with zod
// // const row = z.object({ email: z.string().email() }).parse($json);
// // return [{ json: row }];
//
// // Scrape links
// // const html = (await axios.get(url, { responseType: 'text', timeout: 10000 })).data;
// // const $c = cheerio.load(html);
// // const links = $c('a[href]').map((i, el) => $c(el).attr('href')).get();
// // return links.map(href => ({ json: { href } }));
//
// // CSV rows
// // const parsed = Papa.parse(String($json.csv), { header: true, skipEmptyLines: true });
// // return parsed.data.map(row => ({ json: row }));
// =============================================================================

// --- Starter: pass-through enrich (All Items). Replace with your workflow logic. ---
const rows = $input.all().map((i) => i.json);

return rows.map((row, index) => ({
  json: {
    ...row,
    id: uuid.v4(),
    at: dayjs().toISOString(),
  },
  pairedItem: { item: index },
}));
`;

const DEFAULT_PYTHON = `# Code Pro Python: trusted native Python 3.11+ (not sandboxed).
# All-items mode: _input.all(), _input.first(), and items are available.
# Each-item mode also provides _input.item, _json, _item, _item_index, and item.
# Return n8n items. Use pairedItem when output counts differ.
# python_utils: get_runtime_info(), is_package_available(), http_get(), http_request(), retry().

rows = _input.all()
runtime = python_utils.get_runtime_info()

return [
    {
        "json": {"rows": len(rows), "python": runtime["version"]},
        "pairedItem": {"item": 0},
    }
]
`;

export class CodePro implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Code Pro',
		name: 'codePro',
		icon: { light: 'file:codepro.png', dark: 'file:codepro.png' },
		group: ['transform'],
		version: 1,
		description:
			'Run JavaScript with stock Code-compatible helpers and automation globals, or trusted native Python 3.11+ with matching item semantics.',
		defaults: {
			name: 'Code Pro',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		parameterPane: 'wide',
		hints: [
			{
				message:
					'Code Pro executes trusted code, not a security sandbox. JavaScript and native Python can access the n8n environment, files, network, subprocesses, credentials, and workflow data. Never run unreviewed or user-supplied code.',
				type: 'warning',
				location: 'ndv',
				whenToDisplay: 'beforeExecution',
			},
		],
		properties: [
			{
				displayName:
					'<b>Security:</b> Code Pro runs <b>trusted code only</b>, not a security sandbox. JavaScript runs in n8n and Python runs in a native child process; both have the n8n user\'s filesystem, network, subprocess, environment, credential, and workflow-data access. Review every script and use an isolated least-privilege worker/container for untrusted code.',
				name: 'securityNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'JavaScript',
						value: 'javaScript',
						description: 'Use the existing Code Pro JavaScript runtime and library globals',
					},
					{
						name: 'Python',
						value: 'python',
						description: 'Use a native Python 3.11+ child process on this worker',
					},
				],
				default: 'javaScript',
			},
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Run Once for All Items',
						value: 'runOnceForAllItems',
						description: 'Run this code only once, no matter how many input items there are',
					},
					{
						name: 'Run Once for Each Item',
						value: 'runOnceForEachItem',
						description: 'Run this code as many times as there are input items',
					},
				],
				default: 'runOnceForAllItems',
			},
			{
				displayName: 'JavaScript',
				name: 'jsCode',
				displayOptions: {
					show: {
						language: ['javaScript'],
					},
				},
				type: 'string',
				typeOptions: {
					// jsEditor: larger monospaced feel in the NDV than codeNodeEditor
					editor: 'jsEditor',
				},
				default: DEFAULT_JS,
				description:
					'JavaScript to execute. Default template lists all library globals and patterns for AI/authors. Use <code>$input</code>, <code>$json</code>, <code>items</code>, <code>item</code>, and library globals. Debug with <code>console.log()</code>.',
				noDataExpression: true,
			},
			{
				displayName: 'Python',
				name: 'pythonCode',
				displayOptions: {
					show: {
						language: ['python'],
					},
				},
				type: 'string',
				typeOptions: {
					// Keep the same NDV editor scale and monospaced presentation as JavaScript.
					editor: 'jsEditor',
					editorLanguage: 'python',
				},
				default: DEFAULT_PYTHON,
				description:
					'Python 3.11+ to execute in one native process per node execution. Use <code>_input</code>, <code>_json</code>, <code>_item</code>, <code>_item_index</code>, <code>items</code>/<code>item</code>, and <code>python_utils</code>. <code>print()</code> is captured as node logs.',
				noDataExpression: true,
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: MAX_SOFT_TIMEOUT_SEC,
						},
						// 0 = unlimited soft timeout (async HTTP can run until completion).
						// Recommended for multi-site sitemap discovery / large expands.
						default: 0,
						description:
							'Soft timeout in seconds (per invocation â€” each-item mode gets a full budget per item). 0 = unlimited soft race (wait until the code returns â€” best for sitemaps / long HTTP). >0 races the script and aborts utils.sitemap HTTP via AbortSignal. Sync loops before the first await hit a ~60s VM guard. CPU loops resumed after await cannot be hard-stopped in-process and can block n8n. Plain axios without signal may linger briefly after a soft timeout. Max 3600.',
					},
					{
						displayName: 'Max Output Items',
						name: 'maxOutputItems',
						type: 'number',
						typeOptions: {
							minValue: 1,
							maxValue: 1_000_000,
						},
						default: 10_000,
						description:
							'Fail if the code returns more items than this (protects memory from runaway maps)',
					},
				],
			},
			{
				displayName: 'Python Runtime',
				name: 'pythonOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						language: ['python'],
					},
				},
				options: [
					{
						displayName: 'Python Executable',
						name: 'pythonExecutable',
						type: 'string',
						default: '',
						description:
							'Optional absolute executable path. When blank, Code Pro checks CODE_PRO_PYTHON_PATH, python3, python, then Windows py -3.',
					},
					{
						displayName: 'Max Python Protocol Size (MiB)',
						name: 'maxProtocolMiB',
						type: 'number',
						typeOptions: {
							minValue: 1,
							maxValue: 64,
						},
						default: 10,
						description: 'Maximum UTF-8 JSON request or final response size. Default: 10 MiB.',
					},
					{
						displayName: 'Max Python Log Output (KiB)',
						name: 'maxLogKiB',
						type: 'number',
						typeOptions: {
							minValue: 64,
							maxValue: 4096,
						},
						default: 1024,
						description: 'Maximum captured print/stderr output retained for logs and errors. Default: 1 MiB.',
					},
				],
			},
			{
				displayName:
					'<b>Mode:</b> multi-item batch â†’ <b>Run Once for All Items</b>. Each-item: one object (or 1-el array). <code>$input.all()</code> is the full list (stock). Sitemaps: <code>utils.sitemap.find</code> / <code>fromWebsite</code> / <code>fromWebsites</code> (expand opt-in; watch Max Output Items). <b>Timeout</b> default <b>0</b> = unlimited (long HTTP/sitemaps); set a positive value only if you want a hard soft-cap. Version: <code>utils.getCodeProVersion()</code>.',
				name: 'notice',
				displayOptions: {
					show: {
						language: ['javaScript'],
					},
				},
				type: 'notice',
				default: '',
			},
			{
				displayName:
					'<b>Python setup:</b> Native Python <b>3.11+</b> is required on every executing n8n/queue worker. Resolution: Python Executable, <code>CODE_PRO_PYTHON_PATH</code>, <code>python3</code>, <code>python</code>, Windows <code>py -3</code>. Python inherits the n8n environment and is <b>not sandboxed</b>; run reviewed code only. Positive Timeout values hard-stop the Python process tree for the whole batch; 0 is unlimited. For untrusted code, use a separate least-privilege worker/container or n8n external task runners.',
				name: 'pythonSetupNotice',
				displayOptions: {
					show: {
						language: ['python'],
					},
				},
				type: 'notice',
				default: '',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const mode = this.getNodeParameter('mode', 0) as CodeProMode;
		const language = this.getNodeParameter('language', 0, 'javaScript') as 'javaScript' | 'python';
		const options = this.getNodeParameter('options', 0, {}) as {
			timeout?: number;
			maxOutputItems?: number;
		};
		// 0 = unlimited soft timeout (default). Shared coerce with runUserCode.
		const timeout = coerceTimeoutSec(options.timeout);
		const maxOutputItems = coerceMaxOutputItems(options.maxOutputItems);

		if (language === 'python') {
			const code = this.getNodeParameter('pythonCode', 0) as string;
			const pythonOptions = this.getNodeParameter('pythonOptions', 0, {}) as {
				pythonExecutable?: string;
				maxProtocolMiB?: number;
				maxLogKiB?: number;
			};
			if (!code?.trim()) {
				throw new NodeOperationError(this.getNode(), 'No Python code provided.');
			}
			return await executePythonNode(this, {
				items,
				mode,
				code,
				timeout,
				maxOutputItems,
				continueOnFail: this.continueOnFail(),
				explicitExecutable: pythonOptions.pythonExecutable,
				maxProtocolBytes: coercePythonProtocolMiB(pythonOptions.maxProtocolMiB),
				maxLogBytes: coercePythonLogKiB(pythonOptions.maxLogKiB),
			});
		}

		const code = this.getNodeParameter('jsCode', 0) as string;
		if (!code?.trim()) {
			throw new NodeOperationError(this.getNode(), 'No JavaScript code provided.');
		}

		const normalize = ((raw: unknown) =>
			this.helpers.normalizeItems(raw as INodeExecutionData | INodeExecutionData[])) as (
			raw: unknown,
		) => INodeExecutionData[];

		try {
			if (mode === 'runOnceForEachItem') {
				const returnData: INodeExecutionData[] = [];

				for (let i = 0; i < items.length; i++) {
					try {
						// Cap before continueOnFail can swallow it
						enforceMaxOutputItemCount(returnData.length + 1, maxOutputItems, this);

						const raw = await runUserCode({
							code,
							items: [items[i]],
							allItems: items,
							itemIndex: i,
							mode,
							timeoutSec: timeout,
							ctx: this,
						});

						const validated = validateRunCodeEachItem(raw, i, normalize);
						if (validated !== undefined) returnData.push(validated);
					} catch (error) {
						// Never swallow output-cap failures
						if (isMaxOutputItemsError(error)) {
							throw error;
						}
						if (this.continueOnFail()) {
							returnData.push({
								json: continueOnFailPayload(error, timeout),
								pairedItem: { item: i },
							});
							continue;
						}
						throw wrapError(this, error, i, timeout);
					}
				}

				const capped = enforceMaxOutputItems(returnData, maxOutputItems, this);
				maybeAddPairedItemHint(this, capped, items.length);
				return [capped];
			}

			// runOnceForAllItems
			const raw = await runUserCode({
				code,
				items,
				allItems: items,
				itemIndex: 0,
				mode,
				timeoutSec: timeout,
				ctx: this,
			});

			if (Array.isArray(raw)) {
				enforceMaxOutputItemCount(raw.length, maxOutputItems, this);
			}
			const validated = validateRunCodeAllItems(raw, normalize);
			const capped = enforceMaxOutputItems(validated, maxOutputItems, this);
			maybeAddPairedItemHint(this, capped, items.length);
			return [capped];
		} catch (error) {
			// Never swallow memory/output-cap failures under continueOnFail
			if (isMaxOutputItemsError(error)) {
				throw error;
			}
			if (this.continueOnFail() && mode === 'runOnceForAllItems') {
				return [[{ json: continueOnFailPayload(error, timeout), pairedItem: { item: 0 } }]];
			}
			throw wrapError(this, error, undefined, timeout);
		}
	}
}

interface PythonNodeExecutionOptions {
	items: INodeExecutionData[];
	mode: CodeProMode;
	code: string;
	timeout: number;
	maxOutputItems: number;
	continueOnFail: boolean;
	explicitExecutable?: string;
	maxProtocolBytes: number;
	maxLogBytes: number;
}

function getPythonCancellationHooks(ctx: IExecuteFunctions): {
	cancelSignal?: AbortSignal;
	onExecutionCancellation?: (handler: () => unknown) => void;
} {
	const cancellable = ctx as IExecuteFunctions & {
		getExecutionCancelSignal?: () => AbortSignal | undefined;
		onExecutionCancellation?: (handler: () => unknown) => void;
	};
	return {
		cancelSignal:
			typeof cancellable.getExecutionCancelSignal === 'function'
				? cancellable.getExecutionCancelSignal()
				: undefined,
		onExecutionCancellation:
			typeof cancellable.onExecutionCancellation === 'function'
				? cancellable.onExecutionCancellation.bind(cancellable)
				: undefined,
	};
}

function logPythonFailure(ctx: IExecuteFunctions, error: unknown): void {
	if (!isPythonRunnerError(error)) return;
	logPythonOutput(ctx, {
		stdout: error.details.stdout ?? '',
		stderr: error.details.stderr ?? '',
		truncated: error.details.logsTruncated ?? false,
	});
}

async function executePythonNode(
	ctx: IExecuteFunctions,
	options: PythonNodeExecutionOptions,
): Promise<INodeExecutionData[][]> {
	const normalize = ((raw: unknown) =>
		ctx.helpers.normalizeItems(raw as INodeExecutionData | INodeExecutionData[])) as (
		raw: unknown,
	) => INodeExecutionData[];
	let loggedRunnerOutput = false;

	try {
		const cancellation = getPythonCancellationHooks(ctx);
		const execution = await runPythonCode({
			code: options.code,
			mode: options.mode,
			items: options.items,
			timeoutSec: options.timeout,
			continueOnFail: options.continueOnFail,
			explicitExecutable: options.explicitExecutable,
			maxProtocolBytes: options.maxProtocolBytes,
			maxLogBytes: options.maxLogBytes,
			...cancellation,
		});
		logPythonOutput(ctx, execution.logs);
		loggedRunnerOutput = true;

		if (options.mode === 'runOnceForEachItem') {
			const returnData: INodeExecutionData[] = [];
			for (let i = 0; i < options.items.length; i++) {
				try {
					const itemResult = execution.results?.[i];
					if (!itemResult) {
						throw new NodeOperationError(ctx.getNode(), 'Python returned no result for an input item.');
					}
					if (!itemResult.ok) throw itemResult.error;
					const validated = validateRunCodeEachItem(itemResult.value, i, normalize);
					if (validated !== undefined) {
						enforceMaxOutputItemCount(returnData.length + 1, options.maxOutputItems, ctx);
						returnData.push(validated);
					}
				} catch (error) {
					if (isMaxOutputItemsError(error)) throw error;
					if (!options.continueOnFail) throw wrapError(ctx, error, i, options.timeout);
					returnData.push({
						json: continueOnFailPayload(error, options.timeout),
						pairedItem: { item: i },
					});
				}
			}
			const capped = enforceMaxOutputItems(returnData, options.maxOutputItems, ctx);
			maybeAddPairedItemHint(ctx, capped, options.items.length);
			return [capped];
		}

		const raw = execution.result;
		if (Array.isArray(raw)) enforceMaxOutputItemCount(raw.length, options.maxOutputItems, ctx);
		const validated = validateRunCodeAllItems(raw, normalize);
		const capped = enforceMaxOutputItems(validated, options.maxOutputItems, ctx);
		maybeAddPairedItemHint(ctx, capped, options.items.length);
		return [capped];
	} catch (error) {
		if (!loggedRunnerOutput) logPythonFailure(ctx, error);
		if (isMaxOutputItemsError(error)) throw error;
		if (options.continueOnFail) {
			if (options.mode === 'runOnceForAllItems') {
				return [[{ json: continueOnFailPayload(error, options.timeout), pairedItem: { item: 0 } }]];
			}
			const failed = options.items.map((_, itemIndex) => ({
				json: continueOnFailPayload(error, options.timeout),
				pairedItem: { item: itemIndex },
			}));
			return [enforceMaxOutputItems(failed, options.maxOutputItems, ctx)];
		}
		throw wrapError(ctx, error, undefined, options.timeout);
	}
}

/** Structured item payload when continueOnFail is enabled. */
function continueOnFailPayload(error: unknown, timeoutSec: number): IDataObject {
	const message = error instanceof Error ? error.message : String(error);
	if (isTimeoutError(error)) {
		const meta = getTimeoutErrorMeta(timeoutSec);
		return {
			error: message,
			errorCode: meta.errorCode,
			timeoutSec: meta.timeoutSec,
			hint: meta.description,
		};
	}
		if (isPythonRunnerError(error)) {
			const payload: IDataObject = {
				error: message,
				errorCode: `PYTHON_${error.errorType.toUpperCase()}`,
			};
			if (error.details.userLine !== undefined) payload.userLine = error.details.userLine;
			if (error.details.itemIndex !== undefined) payload.itemIndex = error.details.itemIndex;
			return payload;
		}
	const err = error as Error & { errorCode?: string };
	return {
		error: message,
		errorCode: err.errorCode ?? 'EXECUTION_ERROR',
	};
}

function wrapError(
	ctx: IExecuteFunctions,
	error: unknown,
	itemIndex?: number,
	timeoutSec = 0,
): NodeOperationError {
	if (error instanceof NodeOperationError) {
		return error;
	}

	if (error instanceof CodeProValidationError) {
		return new NodeOperationError(ctx.getNode(), error.message, {
			description: error.description,
			itemIndex: itemIndex ?? error.itemIndex,
		});
	}

	if (isPythonRunnerError(error)) {
		const details: string[] = [`Python error type: ${error.errorType}.`];
		if (error.details.userLine !== undefined) details.push(`User-code line: ${error.details.userLine}.`);
		if (error.details.traceback) {
			details.push(`Traceback:\n${error.details.traceback.slice(0, 2000)}`);
		}
		if (error.errorType === 'timeout') {
			details.push('The native Python process tree was terminated after the configured hard timeout.');
		}
		return new NodeOperationError(ctx.getNode(), `Code Pro Python failed: ${error.message}`, {
			description: details.join('\n'),
			itemIndex: itemIndex ?? error.details.itemIndex,
		});
	}

	if (error instanceof PythonRuntimeUnavailableError) {
		return new NodeOperationError(ctx.getNode(), `Code Pro Python setup required: ${error.message}`, {
			itemIndex,
		});
	}

	const message = error instanceof Error ? error.message : String(error);

	if (isTimeoutError(error)) {
		const meta = getTimeoutErrorMeta(timeoutSec);
		// Avoid double "Code Pro â€¦" prefix when message is already our timeout text
		const display = message.startsWith('Code Pro ')
			? message
			: `Code Pro execution failed: ${message}`;
		return new NodeOperationError(ctx.getNode(), display, {
			description: meta.description,
			itemIndex,
		});
	}

	return new NodeOperationError(ctx.getNode(), `Code Pro execution failed: ${message}`, {
		itemIndex,
	});
}
