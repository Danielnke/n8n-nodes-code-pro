import {
	NodeConnectionTypes,
	NodeOperationError,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { runUserCode, type CodeProMode } from '../../src/executeUserCode';
import {
	enforceMaxOutputItems,
	isMaxOutputItemsError,
	maybeAddPairedItemHint,
} from '../../src/outputGuards';
import {
	CodeProValidationError,
	validateRunCodeAllItems,
	validateRunCodeEachItem,
} from '../../src/resultValidation';

const DEFAULT_JS = `// Code Pro Node — 70+ JavaScript Libraries Available
// Available: _, lodash, axios, cheerio, dayjs, moment, dateFns, dateFnsTz,
//   luxon, DateTime, cronParser, joi, Joi, validator, Ajv, yup, z, zod,
//   phoneNumber, iban, uuid, nanoid, bytes, ms, qs, slug, pluralize,
//   xml2js, XMLParser, XMLBuilder, YAML, papaparse, Papa, ini, toml,
//   jmespath, jsonDiff, Handlebars, htmlToText, marked, cheerio, franc,
//   compromise, fuzzy, stringSimilarity, pRetry, FormData,
//   CryptoJS, forge, jwt, bcrypt, bcryptjs, nodeCrypto, secp256k1, bip39,
//   XLSX, xlsx, ExcelJS, JSZip, pako, QRCode, exifr,
//   Jimp, jimp, imageSize, JPEG, PNG,
//   ffmpeg, ffmpegStatic, ffprobeStatic,
//   web3, ccxt, coinGecko, solana, bitcoin, ytdl,
//   axios, FormData, utils

// 🔄 EXECUTION MODE SUPPORT:
// - "Run Once for All Items": Access all items via $input.all() or items variable
// - "Run Once for Each Item": Access current item via $input.item or item variable

// For "Run Once for All Items" mode:
if (typeof items !== 'undefined') {
    console.log('Running in "Run Once for All Items" mode');
    console.log('Total items:', items.length);
    // Process all items together
    const allData = items.map(item => item.json);
    return items.map((item, index) => ({
        json: {
            ...item.json,
            id: uuid.v4(),
            at: dayjs().toISOString(),
            result: 'Processed all items together'
        },
        pairedItem: { item: index },
    }));
}

// For "Run Once for Each Item" mode:
if (typeof item !== 'undefined') {
    console.log('Running in "Run Once for Each Item" mode');
    console.log('Current item:', item.json);
    // Process single item
    return {
        json: {
            ...item.json,
            id: uuid.v4(),
            at: dayjs().toISOString(),
            result: 'Processed individual item'
        },
    };
}

// Fallback
const data = $input.first().json;
return {
    json: {
        result: 'Hello from Code Pro!',
        fallback: true,
        ...data
    },
};
`;

export class CodePro implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Code Pro',
		name: 'codePro',
		icon: { light: 'file:codepro.png', dark: 'file:codepro.png' },
		group: ['transform'],
		version: 1,
		description:
			'Run JavaScript with stock Code-compatible modes/helpers and 70+ built-in automation libraries (data, image, video tooling)',
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
					editor: 'codeNodeEditor',
					editorLanguage: 'javaScript',
				},
				default: DEFAULT_JS,
				description:
					'JavaScript to execute. Use <code>$input</code>, <code>$json</code>, <code>items</code>, <code>item</code>, and library globals. Debug with <code>console.log()</code>.',
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
					'<b>Mode:</b> multi-item scripts (e.g. sitemap fetch loops) need <b>Run Once for All Items</b>. Each-item accepts one object or a 1-element array. Flat objects without <code>json:</code> are auto-wrapped. Long HTTP loops: raise <b>Options → Timeout</b> (default 60s; sequential 8s axios retries can exceed it). Inventory: <code>utils.getAvailableLibraries()</code>.',
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
