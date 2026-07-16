/**
 * First-party `utils` global (SuperCode-compatible surface + Code Pro helpers).
 */

export interface RetryOptions {
	attempts?: number;
	delay?: number;
}

export function createUtilsBag(getAvailableLibraries: () => string[]): Record<string, unknown> {
	return {
		sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

		retry: async <T>(fn: () => Promise<T> | T, options: RetryOptions = {}): Promise<T> => {
			const attempts = options.attempts ?? 3;
			const delay = options.delay ?? 1000;
			let lastError: unknown;
			for (let i = 0; i < attempts; i++) {
				try {
					return await fn();
				} catch (error) {
					lastError = error;
					if (i < attempts - 1) {
						await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
					}
				}
			}
			throw lastError;
		},

		flatten: function flatten(
			obj: Record<string, unknown>,
			prefix = '',
		): Record<string, unknown> {
			const flattened: Record<string, unknown> = {};
			for (const key of Object.keys(obj ?? {})) {
				const newKey = prefix ? `${prefix}.${key}` : key;
				const value = obj[key];
				if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
					Object.assign(flattened, flatten(value as Record<string, unknown>, newKey));
				} else {
					flattened[newKey] = value;
				}
			}
			return flattened;
		},

		isEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '')),

		isUrl: (url: string) => {
			try {
				// eslint-disable-next-line no-new
				new URL(url);
				return true;
			} catch {
				return false;
			}
		},

		sanitizeInput: (input: string) =>
			String(input ?? '')
				.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
				.replace(/javascript:/gi, '')
				.replace(/on\w+\s*=/gi, '')
				.trim(),

		getAvailableLibraries,

		memoryUsage: () => {
			const usage = process.memoryUsage();
			return {
				heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
				heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
				external: `${Math.round(usage.external / 1024 / 1024)} MB`,
				rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
			};
		},
	};
}
