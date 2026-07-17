/**
 * CommonJS / default-export helpers and missing-library stubs.
 */

/** Marker on missing-library stubs (do not count as "available"). */
export const CODE_PRO_MISSING = Symbol.for('n8n-nodes-code-pro.missingLibrary');

export function isMissingLibrary(value: unknown): boolean {
	if (value == null) return true;
	if (typeof value === 'function' || typeof value === 'object') {
		try {
			return Boolean((value as Record<symbol, unknown>)[CODE_PRO_MISSING]);
		} catch {
			return false;
		}
	}
	return false;
}

export function req(packageName: string): unknown {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	return require(packageName);
}

export function defaultExport(mod: unknown): unknown {
	if (mod && typeof mod === 'object' && 'default' in (mod as object)) {
		const d = (mod as { default: unknown }).default;
		if (d !== undefined) return d;
	}
	return mod;
}

export function createMissingStub(injectName: string, packageName: string): unknown {
	const message = `Code Pro library '${injectName}' is not available (failed to load npm package '${packageName}'). Check install, platform binaries, or ESM compatibility.`;
	const handler: ProxyHandler<object> = {
		get(_t, prop) {
			if (prop === CODE_PRO_MISSING) return true;
			if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'valueOf') {
				return () => `[missing library ${injectName}]`;
			}
			if (prop === 'then') return undefined; // not a thenable
			throw new Error(message);
		},
		apply() {
			throw new Error(message);
		},
	};
	const fn = () => {
		throw new Error(message);
	};
	Object.defineProperty(fn, CODE_PRO_MISSING, {
		value: true,
		enumerable: false,
		configurable: false,
	});
	return new Proxy(fn, handler);
}
