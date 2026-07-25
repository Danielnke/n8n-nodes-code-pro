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
	/**
	 * Soft timeout in seconds for this invocation.
	 * - `> 0`: Promise.race + AbortController (cancels utils.sitemap HTTP).
	 * - `0`: unlimited soft timeout (async work can run until completion; SuperCode-like).
	 */
	timeoutSec: number;
	ctx: IExecuteFunctions;
	extraGlobals?: Record<string, unknown>;
	loadLibraries?: boolean;
}
