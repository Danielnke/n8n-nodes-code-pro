/**
 * A-lite materialize: place library injects on the VM sandbox object.
 *
 * - Data properties (eager / already loaded) → plain assign
 * - Getters (lazy) → wrapper that loads once then defines a data property on *sandbox*
 *
 * Heavies stay lazy; materialize target is the sandbox (not only the shared registry map).
 */

export function installLibraryGlobalsOnSandbox(
	sandbox: Record<string, unknown>,
	libraryGlobals: Record<string, unknown>,
): void {
	for (const key of Object.getOwnPropertyNames(libraryGlobals)) {
		const desc = Object.getOwnPropertyDescriptor(libraryGlobals, key);
		if (!desc) continue;

		if (typeof desc.get === 'function') {
			Object.defineProperty(sandbox, key, {
				enumerable: true,
				configurable: true,
				get() {
					// Trigger registry load (may materialize shared globals too)
					const value = (libraryGlobals as Record<string, unknown>)[key];
					Object.defineProperty(sandbox, key, {
						enumerable: true,
						configurable: true,
						writable: true,
						value,
					});
					return value;
				},
			});
			continue;
		}

		if ('value' in desc) {
			Object.defineProperty(sandbox, key, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: desc.value,
			});
		}
	}
}
