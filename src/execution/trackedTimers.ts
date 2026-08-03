/**
 * Per-invocation timer wrappers.
 *
 * User-created timers must not outlive a Code Pro invocation. Otherwise an
 * unawaited timeout or interval can retain the VM context, workflow items, and
 * library objects indefinitely inside the n8n process.
 */

type TimerCallback = (...args: unknown[]) => void;

export interface TrackedTimerController {
	readonly globals: {
		setTimeout: typeof setTimeout;
		clearTimeout: typeof clearTimeout;
		setInterval: typeof setInterval;
		clearInterval: typeof clearInterval;
		setImmediate: typeof setImmediate;
		clearImmediate: typeof clearImmediate;
	};
	dispose: () => void;
}

export function createTrackedTimerController(): TrackedTimerController {
	const timeouts = new Set<ReturnType<typeof setTimeout>>();
	const intervals = new Set<ReturnType<typeof setInterval>>();
	const immediates = new Set<ReturnType<typeof setImmediate>>();
	let disposed = false;

	const trackedSetTimeout = ((
		callback: TimerCallback,
		delay?: number,
		...args: unknown[]
	) => {
		if (disposed) {
			throw new Error('Cannot schedule a timer after the Code Pro invocation ended.');
		}
		let handle: ReturnType<typeof setTimeout>;
		handle = setTimeout((...callbackArgs: unknown[]) => {
			timeouts.delete(handle);
			callback(...callbackArgs);
		}, delay, ...args);
		timeouts.add(handle);
		return handle;
	}) as typeof setTimeout;

	const trackedClearTimeout = ((handle?: ReturnType<typeof setTimeout>) => {
		if (handle !== undefined) timeouts.delete(handle);
		clearTimeout(handle);
	}) as typeof clearTimeout;

	const trackedSetInterval = ((
		callback: TimerCallback,
		delay?: number,
		...args: unknown[]
	) => {
		if (disposed) {
			throw new Error('Cannot schedule an interval after the Code Pro invocation ended.');
		}
		const handle = setInterval(callback, delay, ...args);
		intervals.add(handle);
		return handle;
	}) as typeof setInterval;

	const trackedClearInterval = ((handle?: ReturnType<typeof setInterval>) => {
		if (handle !== undefined) intervals.delete(handle);
		clearInterval(handle);
	}) as typeof clearInterval;

	const trackedSetImmediate = ((callback: TimerCallback, ...args: unknown[]) => {
		if (disposed) {
			throw new Error('Cannot schedule an immediate after the Code Pro invocation ended.');
		}
		let handle: ReturnType<typeof setImmediate>;
		handle = setImmediate((...callbackArgs: unknown[]) => {
			immediates.delete(handle);
			callback(...callbackArgs);
		}, ...args);
		immediates.add(handle);
		return handle;
	}) as typeof setImmediate;

	const trackedClearImmediate = ((handle?: ReturnType<typeof setImmediate>) => {
		if (handle !== undefined) immediates.delete(handle);
		clearImmediate(handle);
	}) as typeof clearImmediate;

	const dispose = () => {
		if (disposed) return;
		disposed = true;
		for (const handle of timeouts) clearTimeout(handle);
		for (const handle of intervals) clearInterval(handle);
		for (const handle of immediates) clearImmediate(handle);
		timeouts.clear();
		intervals.clear();
		immediates.clear();
	};

	return {
		globals: {
			setTimeout: trackedSetTimeout,
			clearTimeout: trackedClearTimeout,
			setInterval: trackedSetInterval,
			clearInterval: trackedClearInterval,
			setImmediate: trackedSetImmediate,
			clearImmediate: trackedClearImmediate,
		},
		dispose,
	};
}
