/**
 * Resolve AbortSignal for sitemap HTTP: explicit option wins composition with
 * the Code Pro soft-timeout signal when both exist.
 */

import { getExecutionAbortSignal } from '../../execution/executionContext';

/**
 * Prefer explicit `options.signal`, but still honor the execution soft-timeout
 * signal when both are present (Node 20+ `AbortSignal.any`).
 */
export function resolveSitemapSignal(explicit?: AbortSignal): AbortSignal | undefined {
	const execution = getExecutionAbortSignal();
	if (explicit && execution && explicit !== execution) {
		const anyFn = (
			AbortSignal as typeof AbortSignal & {
				any?: (signals: AbortSignal[]) => AbortSignal;
			}
		).any;
		if (typeof anyFn === 'function') {
			return anyFn.call(AbortSignal, [explicit, execution]);
		}
		// Fallback: if either already aborted, return that; else prefer explicit
		// (soft timeout will still fail the script via Promise.race).
		if (explicit.aborted) return explicit;
		if (execution.aborted) return execution;
		return explicit;
	}
	return explicit ?? execution;
}
