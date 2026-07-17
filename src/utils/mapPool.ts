/**
 * Bounded concurrency map — preserves input order in results.
 */

export async function mapPool<T, R>(
	items: readonly T[],
	concurrency: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const n = items.length;
	if (n === 0) return [];
	const limit = Math.max(1, Math.min(Math.floor(concurrency) || 1, n));
	const results = new Array<R>(n);
	let next = 0;

	async function worker(): Promise<void> {
		for (;;) {
			const i = next++;
			if (i >= n) return;
			results[i] = await fn(items[i], i);
		}
	}

	const workers = Array.from({ length: limit }, () => worker());
	await Promise.all(workers);
	return results;
}
