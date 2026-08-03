/**
 * Per-invocation execution context for Code Pro.
 *
 * Library globals (including utils.sitemap) are shared across runs. This module
 * stores the active AbortSignal for the current runUserCode call so network
 * helpers can cancel in-flight work when the soft timeout fires.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { TrackedTimerController } from './trackedTimers';

export interface CodeProExecutionStore {
	/** AbortSignal aborted when Options → Timeout (soft) fires. */
	signal?: AbortSignal;
	/** Soft timeout in seconds; 0 = unlimited (no soft race). */
	timeoutSec: number;
	/** Wall-clock start of this invocation (ms). */
	startedAt: number;
	/** Invocation-scoped timers used by helpers such as utils.sleep/retry. */
	timers?: TrackedTimerController['globals'];
}

const storage = new AsyncLocalStorage<CodeProExecutionStore>();

/**
 * Run `fn` with the given execution store visible to getExecutionContext().
 */
export function runWithExecutionContext<T>(
	store: CodeProExecutionStore,
	fn: () => Promise<T>,
): Promise<T> {
	return storage.run(store, fn);
}

/** Active execution store, or undefined outside runUserCode. */
export function getExecutionContext(): CodeProExecutionStore | undefined {
	return storage.getStore();
}

/**
 * AbortSignal for the current Code Pro invocation (if any).
 * Prefer explicit `options.signal` in helpers when the caller passes one.
 */
export function getExecutionAbortSignal(): AbortSignal | undefined {
	return storage.getStore()?.signal;
}

/** Invocation-scoped timers, or undefined outside runUserCode. */
export function getExecutionTimers(): TrackedTimerController['globals'] | undefined {
	return storage.getStore()?.timers;
}
