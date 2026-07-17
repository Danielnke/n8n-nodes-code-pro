import type { INodeExecutionData } from 'n8n-workflow';

/** Reserved top-level keys on n8n items (stock Code node). */
export const REQUIRED_N8N_ITEM_KEYS = new Set(['json', 'binary', 'pairedItem', 'error', 'index']);

export class CodeProValidationError extends Error {
	constructor(
		message: string,
		public readonly description?: string,
		public readonly itemIndex?: number,
	) {
		super(message);
		this.name = 'CodeProValidationError';
	}
}

function isObject(maybe: unknown): maybe is Record<string, unknown> {
	return (
		typeof maybe === 'object' && maybe !== null && !Array.isArray(maybe) && !(maybe instanceof Date)
	);
}

function validateItem(item: INodeExecutionData, itemIndex: number): void {
	if (item.json === undefined || !isObject(item.json as unknown)) {
		throw new CodeProValidationError(
			`A 'json' property isn't an object`,
			`In the returned data, every key named 'json' must point to an object.`,
			itemIndex,
		);
	}

	if (item.binary !== undefined && !isObject(item.binary as unknown)) {
		throw new CodeProValidationError(
			`A 'binary' property isn't an object`,
			`In the returned data, every key named 'binary' must point to an object.`,
			itemIndex,
		);
	}
}

function validateTopLevelKeys(item: INodeExecutionData, itemIndex: number): void {
	let foundReservedKey: string | null = null;
	const unknownKeys: string[] = [];

	for (const key of Object.keys(item)) {
		if (REQUIRED_N8N_ITEM_KEYS.has(key)) {
			foundReservedKey ??= key;
		} else {
			unknownKeys.push(key);
		}
	}

	if (unknownKeys.length > 0) {
		if (foundReservedKey) {
			throw new CodeProValidationError(
				`Invalid item key mix: reserved key '${foundReservedKey}' with unknown key '${unknownKeys[0]}'`,
				`Access custom properties under .json (e.g. item.json.myField), not at the top level of the item.`,
				itemIndex,
			);
		}

		throw new CodeProValidationError(
			`Unknown top-level item key: ${unknownKeys[0]}`,
			'Access the properties of an item under `.json`, e.g. `item.json`',
			itemIndex,
		);
	}
}

/** Normalize fn signature (compatible with `this.helpers.normalizeItems`). */
export type NormalizeItemsFn = (items: unknown) => INodeExecutionData[];

/**
 * Minimal normalizeItems (mirrors n8n helpers behavior used by stock Code).
 * Wraps plain objects as { json: obj } when they are not already item-shaped.
 */
export function normalizeItems(items: unknown): INodeExecutionData[] {
	const list = Array.isArray(items) ? items : [items];

	return list.map((raw) => {
		if (!isObject(raw)) {
			throw new CodeProValidationError(
				"Code doesn't return items properly",
				'Please return an array of objects, one for each item you would like to output.',
			);
		}

		// Already an n8n item (has json and/or binary)
		if ('json' in raw || 'binary' in raw) {
			const item = raw as INodeExecutionData;
			if (item.json === undefined) {
				item.json = {};
			}
			return item;
		}

		// Plain object → wrap
		return { json: raw as INodeExecutionData['json'] };
	});
}

/** Stock Code: runOnceForEachItem — single object only. */
export function validateRunCodeEachItem(
	executionResult: unknown,
	itemIndex: number,
	normalize: NormalizeItemsFn = normalizeItems,
): INodeExecutionData {
	if (executionResult === null || executionResult === undefined) {
		return { json: {}, pairedItem: { item: itemIndex } };
	}

	if (typeof executionResult !== 'object') {
		throw new CodeProValidationError(
			`Code doesn't return an object`,
			`Please return an object representing the output item. ('${String(executionResult)}' was returned instead.)`,
			itemIndex,
		);
	}

	// SuperCode-compat: many snippets always `return [ { ... } ]` even for one item.
	// Stock Code rejects any array; we accept a single-element array and unwrap it.
	if (Array.isArray(executionResult)) {
		if (executionResult.length === 0) {
			return { json: {}, pairedItem: { item: itemIndex } };
		}
		if (executionResult.length === 1) {
			executionResult = executionResult[0];
			if (executionResult === null || executionResult === undefined) {
				return { json: {}, pairedItem: { item: itemIndex } };
			}
			if (typeof executionResult !== 'object' || Array.isArray(executionResult)) {
				throw new CodeProValidationError(
					`Code doesn't return a single object`,
					`The array's only element must be an object (got ${Array.isArray(executionResult) ? 'array' : typeof executionResult}).`,
					itemIndex,
				);
			}
		} else {
			throw new CodeProValidationError(
				`Code doesn't return a single object`,
				`An array of ${executionResult.length} items was returned. In "Run Once for Each Item" mode return one object (or a one-element array). For multi-item output use "Run Once for All Items".`,
				itemIndex,
			);
		}
	}

	const [returnData] = normalize(executionResult as INodeExecutionData);
	validateItem(returnData, itemIndex);
	// After normalize, plain SuperCode objects become { json: {...} } — only validate keys on final shape
	validateTopLevelKeys(returnData, itemIndex);

	if (returnData.pairedItem === undefined) {
		returnData.pairedItem = { item: itemIndex };
	}

	return returnData;
}

/** Stock Code: runOnceForAllItems — object or array of objects. */
export function validateRunCodeAllItems(
	executionResult: unknown,
	normalize: NormalizeItemsFn = normalizeItems,
): INodeExecutionData[] {
	if (executionResult === null || executionResult === undefined) {
		return [];
	}

	if (typeof executionResult !== 'object') {
		throw new CodeProValidationError(
			"Code doesn't return items properly",
			'Please return an array of objects, one for each item you would like to output.',
		);
	}

	if (Array.isArray(executionResult)) {
		for (const item of executionResult) {
			if (!isObject(item)) {
				throw new CodeProValidationError(
					"Code doesn't return items properly",
					'Please return an array of objects, one for each item you would like to output.',
				);
			}
		}

		const mustHaveTopLevelN8nKey = executionResult.some((item) =>
			Object.keys(item as object).some((key) => REQUIRED_N8N_ITEM_KEYS.has(key)),
		);

		if (mustHaveTopLevelN8nKey) {
			for (let index = 0; index < executionResult.length; index++) {
				validateTopLevelKeys(executionResult[index] as INodeExecutionData, index);
			}
		}
	}

	const returnData = normalize(
		executionResult as INodeExecutionData | INodeExecutionData[],
	);
	returnData.forEach((item, index) => validateItem(item, index));
	return returnData;
}
