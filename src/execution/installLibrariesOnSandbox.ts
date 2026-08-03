/**
 * A-lite materialize: place library injects on the VM sandbox object.
 *
 * - Data properties (eager / already loaded) → plain assign
 * - Getters (lazy) → wrapper that loads once then defines a data property on *sandbox*
 *
 * Heavies stay lazy; materialize target is the sandbox (not only the shared registry map).
 */

function isolateLibraryValue(
	key: string,
	value: unknown,
	cache: Map<unknown, unknown>,
): unknown {
	if ((typeof value !== 'object' || value === null) && typeof value !== 'function') {
		return value;
	}
	if (cache.has(value)) return cache.get(value);

	let isolated: unknown = value;
	if (key === 'axios') {
		const axios = value as { create?: () => unknown };
		if (typeof axios.create === 'function') isolated = axios.create();
	} else if (key === '_' || key === 'lodash') {
		const lodash = value as { runInContext?: () => unknown };
		if (typeof lodash.runInContext === 'function') isolated = lodash.runInContext();
	} else if (key === 'Handlebars') {
		const handlebars = value as { create?: () => unknown };
		if (typeof handlebars.create === 'function') isolated = handlebars.create();
	} else if (key === 'utils' && typeof value === 'object') {
		isolated = Object.defineProperties({}, Object.getOwnPropertyDescriptors(value));
	}

	cache.set(value, isolated);
	return isolated;
}

export function installLibraryGlobalsOnSandbox(
	sandbox: Record<string, unknown>,
	libraryGlobals: Record<string, unknown>,
): void {
	const isolatedValues = new Map<unknown, unknown>();
	for (const key of Object.getOwnPropertyNames(libraryGlobals)) {
		const desc = Object.getOwnPropertyDescriptor(libraryGlobals, key);
		if (!desc) continue;

		if (typeof desc.get === 'function') {
			Object.defineProperty(sandbox, key, {
				enumerable: true,
				configurable: true,
				get() {
					// Trigger registry load (may materialize shared globals too)
					const sharedValue = (libraryGlobals as Record<string, unknown>)[key];
					const value = isolateLibraryValue(key, sharedValue, isolatedValues);
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
				value: isolateLibraryValue(key, desc.value, isolatedValues),
			});
		}
	}
}
