/**
 * Execution engine types (VM sandbox + run options).
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

export type CodeProMode = 'runOnceForAllItems' | 'runOnceForEachItem';

export interface RunUserCodeOptions {
	code: string;
	/** Items passed into this invocation (each-item: usually [current]). */
	items: INodeExecutionData[];
	/** Full workflow input for this node (stock $input.all()). */
	allItems?: INodeExecutionData[];
	itemIndex: number;
	mode: CodeProMode;
	timeoutSec: number;
	ctx: IExecuteFunctions;
	extraGlobals?: Record<string, unknown>;
	loadLibraries?: boolean;
}
