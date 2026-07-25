/**
 * Execute user JavaScript inside the VM sandbox with soft timeout.
 */

import { runInContext } from 'node:vm';

import { buildSandbox } from './buildSandbox';
import { enhanceExecutionError } from './enhanceErrors';
import { runWithExecutionContext } from './executionContext';
import { normalizeTimeoutPolicy } from './timeoutPolicy';
import type { RunUserCodeOptions } from './types';
import { createVmExecutableCode } from './vmWrapper';

/**
 * Execute user JavaScript.
 *
 * Timeout policy:
 * - `timeoutSec > 0`: soft Promise.race + AbortController (cancels sitemap/axios that honor signal).
 * - `timeoutSec === 0` (unlimited): no soft race — async HTTP can run until completion
 *   (matches SuperCode effective behavior). Sync loops still hit SYNC_VM_TIMEOUT_MS.
 *
 * Soft timeout does not guarantee instant kill of every native/ffmpeg path.
 */
export async function runUserCode(options: RunUserCodeOptions): Promise<unknown> {
	const { code } = options;
	const context = buildSandbox(options);
	const executable = createVmExecutableCode(code);

	const { unlimited, timeoutSec, softTimeoutMs, vmTimeoutMs } = normalizeTimeoutPolicy(
		options.timeoutSec,
	);

	const abortController =
		typeof AbortController !== 'undefined' ? new AbortController() : undefined;

	const executionStore = {
		signal: abortController?.signal,
		timeoutSec,
		startedAt: Date.now(),
	};

	return runWithExecutionContext(executionStore, async () => {
		let timer: ReturnType<typeof setTimeout> | undefined;

		const timeoutPromise =
			!unlimited && softTimeoutMs > 0
				? new Promise<never>((_resolve, reject) => {
						timer = setTimeout(() => {
							try {
								abortController?.abort(
									new Error(`Code Pro soft timeout after ${timeoutSec}s`),
								);
							} catch {
								/* ignore double-abort */
							}
							reject(
								new Error(
									`Code Pro soft timeout after ${timeoutSec}s (async work may still finish briefly; in-flight HTTP honoring AbortSignal is cancelled). ` +
										`Raise Options → Timeout, or set Timeout to 0 for unlimited (wait until the code returns). ` +
										`For sitemaps, prefer utils.sitemap.* ; Timeout is per invocation (each-item mode gets a full budget per item).`,
								),
							);
						}, softTimeoutMs);
						// Keep process alive for the soft timer while n8n is running this node
						// (do not unref — unit tests and short-lived scripts must still fire).
					})
				: null;

		try {
			const vmResult = runInContext(executable, context, {
				timeout: vmTimeoutMs,
				displayErrors: true,
			}) as unknown;

			const work = Promise.resolve(vmResult);
			// If timeout wins, a later rejection must not become unhandledRejection on n8n
			work.catch(() => {
				/* orphaned after soft timeout — intentional */
			});

			if (timeoutPromise !== null) {
				return await Promise.race([work, timeoutPromise]);
			}
			return await work;
		} catch (error) {
			throw enhanceExecutionError(error, timeoutSec);
		} finally {
			if (timer !== undefined) clearTimeout(timer);
		}
	});
}
