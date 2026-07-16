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
	CodeProValidationError,
	validateRunCodeAllItems,
	validateRunCodeEachItem,
} from '../../src/resultValidation';

const DEFAULT_JS = `// Code Pro (n8n-nodes-code-pro) — SuperCode-class libraries + stock-compatible modes
// SuperCode-parity: _, lodash, axios, cheerio, dayjs, moment, dateFns, dateFnsTz,
//   joi, Joi, validator, uuid, Ajv, yup, xml2js, XMLParser, YAML, papaparse, Papa,
//   Handlebars, CryptoJS, forge, jwt, bcrypt, bcryptjs, XLSX, QRCode, fuzzy,
//   stringSimilarity, slug, pluralize, qs, FormData, ini, toml, nanoid, bytes,
//   phoneNumber, iban, web3, ytdl, ffmpeg, ffmpegStatic, utils, ccxt, coinGecko,
//   solana, bitcoin, secp256k1, bip39, franc, compromise, pRetry, htmlToText,
//   marked, jsonDiff, cronParser
// Code Pro extras: z, zod, luxon, DateTime, jmespath, JSZip, pako, nodeCrypto, ms, XMLBuilder, ExcelJS
// Modes: $input.all() / items  |  each-item: $json / item / $input.item

const items = $input.all();

return items.map((item, index) => ({
  json: {
    ...item.json,
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
		icon: { light: 'file:codepro.svg', dark: 'file:codepro.svg' },
		group: ['transform'],
		version: 1,
		description:
			'Run JavaScript with stock Code-compatible modes/helpers and 55+ SuperCode-class libraries built in',
		defaults: {
			name: 'Code Pro',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		parameterPane: 'wide',
		properties: [
			{
				displayName:
					'<b>Code Pro</b> runs in the n8n process (not the sandboxed task runner) with a large library surface. Use only on trusted self-hosted instances. Heavy libs (web3, ccxt, ffmpeg, …) load on demand.',
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
					// Prefer stock Code editor; SuperCode uses jsEditor as fallback in some UIs
					editor: 'codeNodeEditor',
					editorLanguage: 'javaScript',
				},
				default: DEFAULT_JS,
				description:
					'JavaScript to execute. Use <code>$input</code>, <code>$json</code>, <code>items</code>, <code>item</code>. Debug with <code>console.log()</code>.',
				noDataExpression: true,
			},
			{
				displayName: 'Timeout',
				name: 'timeout',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 300,
				},
				default: 30,
				description: 'Maximum execution time in seconds (best-effort VM timeout)',
			},
			{
				displayName:
					'Type <code>$</code> for n8n helpers when the proxy is available. Return items as <code>[{ json: { ... } }]</code> (all-items) or a single <code>{ json: { ... } }</code> (each-item).',
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
		const timeout = this.getNodeParameter('timeout', 0, 30) as number;

		if (!code?.trim()) {
			throw new NodeOperationError(this.getNode(), 'No JavaScript code provided.');
		}

		const normalize = ((items: unknown) =>
			this.helpers.normalizeItems(items as INodeExecutionData | INodeExecutionData[])) as (
			items: unknown,
		) => INodeExecutionData[];

		try {
			if (mode === 'runOnceForEachItem') {
				const returnData: INodeExecutionData[] = [];

				for (let i = 0; i < items.length; i++) {
					try {
						const raw = await runUserCode({
							code,
							items: [items[i]],
							itemIndex: i,
							mode,
							timeoutSec: timeout,
							ctx: this,
						});

						const validated = validateRunCodeEachItem(raw, i, normalize);
						returnData.push(validated);
					} catch (error) {
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

				return [returnData];
			}

			// runOnceForAllItems
			const raw = await runUserCode({
				code,
				items,
				itemIndex: 0,
				mode,
				timeoutSec: timeout,
				ctx: this,
			});

			const validated = validateRunCodeAllItems(raw, normalize);
			return [validated];
		} catch (error) {
			if (this.continueOnFail() && mode === 'runOnceForAllItems') {
				const message = error instanceof Error ? error.message : String(error);
				return [[{ json: { error: message } }]];
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
