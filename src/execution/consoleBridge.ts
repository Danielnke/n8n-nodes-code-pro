/**
 * Forward user console.* to n8n logger when available.
 */

import type { IExecuteFunctions } from 'n8n-workflow';

export function createConsole(ctx: IExecuteFunctions) {
	const forward =
		(level: 'log' | 'warn' | 'error') =>
		(...args: unknown[]) => {
			const message = args
				.map((a) => {
					if (typeof a === 'string') return a;
					try {
						return JSON.stringify(a);
					} catch {
						return String(a);
					}
				})
				.join(' ');

			const logger = (
				ctx as unknown as {
					logger?: {
						info: (m: string) => void;
						warn: (m: string) => void;
						error: (m: string) => void;
					};
				}
			).logger;
			if (logger) {
				if (level === 'error') logger.error(`[Code Pro] ${message}`);
				else if (level === 'warn') logger.warn(`[Code Pro] ${message}`);
				else logger.info(`[Code Pro] ${message}`);
			} else if (level === 'error') {
				console.error('[Code Pro]', ...args);
			} else if (level === 'warn') {
				console.warn('[Code Pro]', ...args);
			} else {
				console.log('[Code Pro]', ...args);
			}
		};

	return {
		log: forward('log'),
		warn: forward('warn'),
		error: forward('error'),
		info: forward('log'),
		debug: forward('log'),
	};
}
