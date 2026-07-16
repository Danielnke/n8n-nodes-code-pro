import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/** Marker so continueOnFail cannot swallow output-cap failures via message text alone. */
export const CODE_PRO_MAX_OUTPUT = 'CODE_PRO_MAX_OUTPUT_ITEMS';

export function isMaxOutputItemsError(error: unknown): boolean {
	if (!(error instanceof NodeOperationError)) return false;
	const e = error as NodeOperationError & { description?: string; context?: { codePro?: string } };
	if (e.context?.codePro === CODE_PRO_MAX_OUTPUT) return true;
	if (typeof e.description === 'string' && e.description.includes(CODE_PRO_MAX_OUTPUT)) return true;
	return error.message.includes('Max Output Items');
}

/**
 * Cap output length to protect memory / runaway maps.
 * Throws if over limit (fail-closed). Never bypass with continueOnFail.
 */
export function enforceMaxOutputItems(
	items: INodeExecutionData[],
	maxOutputItems: number,
	ctx: IExecuteFunctions,
): INodeExecutionData[] {
	if (!Number.isFinite(maxOutputItems) || maxOutputItems <= 0) {
		return items;
	}
	if (items.length > maxOutputItems) {
		throw new NodeOperationError(
			ctx.getNode(),
			`Code Pro produced ${items.length} items, which exceeds the Max Output Items limit of ${maxOutputItems}.`,
			{
				description: `${CODE_PRO_MAX_OUTPUT}: Reduce returned items, batch, or raise Max Output Items under Options.`,
				// n8n may ignore unknown fields; description marker is the reliable check
			},
		);
	}
	return items;
}

/**
 * Stock Code-style hint when item linking may break downstream expressions.
 */
export function maybeAddPairedItemHint(
	ctx: IExecuteFunctions,
	returnData: INodeExecutionData[],
	inputItemsLength: number,
): void {
	const addHints = (
		ctx as IExecuteFunctions & {
			addExecutionHints?: (hint: {
				message: string;
				location?: string;
			}) => void;
		}
	).addExecutionHints;

	if (typeof addHints !== 'function') {
		return;
	}

	if (
		returnData.length !== inputItemsLength ||
		returnData.some((item) => item.pairedItem === undefined)
	) {
		addHints({
			message:
				'To make sure expressions after this node work, return the input items that produced each output item (set pairedItem). See n8n item linking docs for the Code node.',
			location: 'outputPane',
		});
	}
}
