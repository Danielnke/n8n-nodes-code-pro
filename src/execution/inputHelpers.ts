/**
 * Stock Code $input helpers (all-items vs each-item).
 *
 * Product decision: each-item $input.all() = FULL list (stock Code semantics).
 */

import type { INodeExecutionData } from 'n8n-workflow';
import type { CodeProMode } from './types';

/**
 * Stock Code semantics:
 * - all-items: $input.all() = full list
 * - each-item: $input.item / $json = current; $input.all() still = FULL list
 */
export function buildInputHelpers(
	allItems: INodeExecutionData[],
	currentItem: INodeExecutionData | undefined,
	mode: CodeProMode,
) {
	if (mode === 'runOnceForEachItem') {
		return {
			all: () => allItems,
			first: () => allItems[0],
			last: () => allItems[allItems.length - 1],
			item: currentItem,
			json: currentItem?.json,
		};
	}

	return {
		all: () => allItems,
		first: () => allItems[0],
		last: () => allItems[allItems.length - 1],
		json: allItems.length === 1 ? allItems[0]?.json : allItems.map((i) => i.json),
	};
}
