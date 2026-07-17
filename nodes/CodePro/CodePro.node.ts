import {
	NodeConnectionTypes,
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { runUserCode, type CodeProMode } from '../../src/execution';
import {
	CodeProValidationError,
	enforceMaxOutputItems,
	isMaxOutputItemsError,
	maybeAddPairedItemHint,
	validateRunCodeAllItems,
	validateRunCodeEachItem,
} from '../../src/validation';

/**
 * Default editor template — AI/human capability card.
 * Full inject inventory, I/O contract, idioms, and pitfalls so models write
 * correct Code Pro scripts without inventing missing libs.
 * ASCII comments only; no nested template-literal backticks or ${} in the body.
 */
const DEFAULT_JS = `// =============================================================================
// CODE PRO — AI / AUTHOR GUIDE (read before writing script)
// Self-hosted n8n community node: JavaScript + 70+ library globals in-process.
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
//     Returning N>1 items in each-item mode FAILS — switch to All Items.
// INPUT HELPERS (stock Code-compatible)
//   $input.all()     -> full input item list in BOTH modes (not shrunk to current)
//   $input.first()   -> first item
//   $input.item      -> current item (each-item mode)
//   $json / item     -> current item json (each-item); items = all items
//   $itemIndex       -> current index (each-item)
// RETURN SHAPE
//   Prefer: return [{ json: { ... }, pairedItem: { item: index } }, ...]
//   Plain objects { a: 1 } auto-wrap to { json: { a: 1 } } in All Items.
//   Keep business data under json; set pairedItem when counts differ.
// OPTIONS
//   Timeout (default 60s): soft race — does NOT hard-cancel in-flight axios/ffmpeg.
//   Max Output Items (default 10000): fail-closed if you return more (expand carefully).
// DEBUG: console.log(...); errors surface as NodeOperationError with hints.
//
// ### FULL INJECT NAME LIST (use ONLY these globals — do not invent packages)
// _, lodash, bytes, ms, qs, uuid, nanoid, utils, dayjs, moment, dateFns, dateFnsTz,
// luxon, DateTime, cronParser, joi, Joi, yup, z, zod, Ajv, validator, phoneNumber, iban,
// papaparse, Papa, xml2js, XMLParser, XMLBuilder, YAML, ini, toml, jmespath, jsonDiff,
// cheerio, htmlToText, marked, Handlebars, slug, pluralize, fuzzy, stringSimilarity,
// franc, compromise, CryptoJS, nodeCrypto, forge, jwt, bcrypt, bcryptjs, secp256k1, bip39,
// axios, FormData, pRetry, XLSX, xlsx, ExcelJS, JSZip, pako, QRCode, Jimp, jimp, imageSize,
// exifr, JPEG, PNG, ffmpeg, ffmpegStatic, ffprobeStatic, web3, ccxt, coinGecko, solana,
// bitcoin, ytdl
// First-party on utils: sitemap.*, mapPool, sleep, retry, flatten, isEmail, isUrl,
//   sanitizeInput, getCodeProVersion, getRegisteredLibraries, getAvailableLibraries,
//   getFailedLibraries, isLibraryAvailable, memoryUsage
//
// ### CAPABILITY MAP — what you can do (with idioms)
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
// SITEMAPS (first-party — prefer over hand-rolled axios loops)
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
//   XLSX.read(buf)  XLSX.utils.sheet_to_json(sheet)  XLSX.write / writeFile
//   new ExcelJS.Workbook()  JSZip / pako  await QRCode.toDataURL(text)
//
// IMAGE / VIDEO
//   const img = await Jimp.read(bufOrUrl); img.resize(200, Jimp.AUTO);
//   imageSize(buf)  await exifr.parse(buf)  JPEG / PNG low-level encode/decode
//   ffmpeg(input).output(out).on('end', ...).run()
//   Binary paths: ffmpegStatic / ffprobeStatic when present on platform
//
// BLOCKCHAIN / TRADING / YT (heavy — only when needed)
//   web3  ccxt  coinGecko  solana  bitcoin  ytdl
//
// ### AI AUTHORING RULES
// 1. Use listed globals only. Prefer global axios — do not invent missing npm names.
// 2. Multi-site / multi-output -> Mode All Items. Never return N items from each-item.
// 3. Prefer utils.sitemap.* for sitemaps; utils.mapPool for concurrency limits.
// 4. Handle HTTP failures; put diagnostics on the item (do not silent-empty without fields).
// 5. Cap expands (maxUrls); respect Max Output Items and Timeout (raise Timeout for batches).
// 6. Put fields under json; set pairedItem when input/output counts differ.
// 7. Keep scripts complete (no truncated braces) — incomplete paste -> SyntaxError.
// 8. Prefer dayjs / uuid / _ for light transforms; load heavy libs only when required.
// 9. Do not assume $input.all() shrinks in each-item mode — it is the FULL list (stock).
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

export class CodePro implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Code Pro',
		name: 'codePro',
		icon: { light: 'file:codepro.png', dark: 'file:codepro.png' },
		group: ['transform'],
		version: 1,
		description:
			'Run JavaScript with stock Code-compatible modes/helpers and 70+ built-in automation libraries (data, image, video tooling). Build identity: utils.getCodeProVersion()',
		defaults: {
			name: 'Code Pro',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		parameterPane: 'wide',
		hints: [
			{
				message:
					'Code Pro executes in the n8n process with full library access. Prefer stock Code on multi-tenant or untrusted instances.',
				type: 'warning',
				location: 'ndv',
				whenToDisplay: 'beforeExecution',
			},
		],
		properties: [
			{
				displayName:
					'<b>Security:</b> Code Pro runs <b>in-process</b> (not the task-runner sandbox) with network-capable libraries (axios, etc.). Use only on <b>trusted self-hosted</b> instances. Heavy libs load when first used.',
				name: 'securityNotice',
				type: 'notice',
				default: '',
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
							minValue: 1,
							maxValue: 300,
						},
						default: 60,
						description:
							'Soft timeout in seconds (sync VM + Promise.race). Raise for sequential HTTP (sitemaps, retries) or media jobs. Does not hard-kill in-flight axios/ffmpeg',
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
				displayName:
					'<b>Mode:</b> multi-item batch → <b>Run Once for All Items</b>. Each-item: one object (or 1-el array). <code>$input.all()</code> is the full list (stock). Sitemaps: <code>utils.sitemap.find</code> / <code>fromWebsite</code> / <code>fromWebsites</code> (expand opt-in; watch Max Output Items). Long HTTP: raise <b>Timeout</b> (default 60s). Default JS is an AI capability guide — full inject list + recipes. Version: <code>utils.getCodeProVersion()</code>.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const mode = this.getNodeParameter('mode', 0) as CodeProMode;
		const code = this.getNodeParameter('jsCode', 0) as string;
		const options = this.getNodeParameter('options', 0, {}) as {
			timeout?: number;
			maxOutputItems?: number;
		};
		const timeout = options.timeout ?? 60;
		const maxOutputItems = options.maxOutputItems ?? 10_000;

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
						if (returnData.length >= maxOutputItems) {
							enforceMaxOutputItems(
								[...returnData, { json: {} }],
								maxOutputItems,
								this,
							);
						}

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
						returnData.push(validated);
					} catch (error) {
						// Never swallow output-cap failures
						if (isMaxOutputItemsError(error)) {
							throw error;
						}
						if (this.continueOnFail()) {
							const message = error instanceof Error ? error.message : String(error);
							returnData.push({
								json: { error: message },
								pairedItem: { item: i },
							});
							continue;
						}
						throw wrapError(this, error, i);
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
				const message = error instanceof Error ? error.message : String(error);
				return [[{ json: { error: message }, pairedItem: { item: 0 } }]];
			}
			throw wrapError(this, error);
		}
	}
}

function wrapError(ctx: IExecuteFunctions, error: unknown, itemIndex?: number): NodeOperationError {
	if (error instanceof NodeOperationError) {
		return error;
	}

	if (error instanceof CodeProValidationError) {
		return new NodeOperationError(ctx.getNode(), error.message, {
			description: error.description,
			itemIndex: itemIndex ?? error.itemIndex,
		});
	}

	const message = error instanceof Error ? error.message : String(error);
	return new NodeOperationError(ctx.getNode(), `Code Pro execution failed: ${message}`, {
		itemIndex,
	});
}
