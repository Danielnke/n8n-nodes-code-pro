/**
 * Execute user JavaScript inside the VM sandbox with soft timeout.
 */

import { runInContext } from 'node:vm';

import { buildSandbox } from './buildSandbox';
import { enhanceExecutionError } from './enhanceErrors';
import type { RunUserCodeOptions } from './types';
import { createVmExecutableCode } from './vmWrapper';

/**
 * Execute user JavaScript.
 *
 * Timeout is **soft / best-effort**:
 * - VM `timeout` only covers the synchronous evaluation window.
 * - Async work uses Promise.race; it does **not** cancel in-flight axios/ffmpeg/timers.
 * - Orphan rejections after a timeout win are swallowed to avoid crashing n8n.
 */
export async function runUserCode(options: RunUserCodeOptions): Promise<unknown> {
	const { code, timeoutSec } = options;
	const context = buildSandbox(options);
	const executable = createVmExecutableCode(code);
	const timeoutMs = Math.max(1, timeoutSec) * 1000;

	let timer: ReturnType<typeof setTimeout> | undefined;
	let timedOut = false;

	const timeoutPromise = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			timedOut = true;
			reject(
				new Error(
					`Code Pro soft timeout after ${timeoutSec}s (async work may still run briefly). Reduce work, avoid hanging HTTP/ffmpeg, or increase Options → Timeout.`,
				),
			);
		}, timeoutMs);
		// Don't keep process alive solely for this timer
		if (typeof timer === 'object' && timer && 'unref' in timer) {
			(timer as NodeJS.Timeout).unref();
		}
	});

	try {
		// VM timeout still helps for tight sync loops; Promise.race covers await work (soft)
		const vmResult = runInContext(executable, context, {
			timeout: timeoutMs,
			displayErrors: true,
		}) as unknown;

		const work = Promise.resolve(vmResult);
		// If timeout wins, a later rejection must not become unhandledRejection on n8n
		work.catch(() => {
			/* orphaned after soft timeout */
		});

		const result = await Promise.race([work, timeoutPromise]);
		if (timedOut) {
			// should not reach (race rejects), but keep type safety
			throw new Error(`Code Pro soft timeout after ${timeoutSec}s.`);
		}
		return result;
	} catch (error) {
		throw enhanceExecutionError(error, timeoutSec);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
