/**
 * Load a single LibraryEntry (require + resolve, or safe binary path).
 */

import type { LibraryEntry } from './types';
import { createMissingStub, defaultExport, req } from './moduleInterop';
import { safeLoadFfmpegPath, safeLoadFfprobePath } from './safeBinaries';

export function loadEntry(entry: LibraryEntry): {
	values: Record<string, unknown>;
	error?: string;
} {
	try {
		// Binary packages: never bare-require when we have safe loaders
		if (entry.packageName === 'ffprobe-static') {
			const p = safeLoadFfprobePath();
			if (p == null) {
				return {
					values: {},
					error: 'ffprobe-static binary unavailable for this platform/arch',
				};
			}
			const resolved = entry.resolve
				? entry.resolve({ path: p })
				: Object.fromEntries(entry.injects.map((name) => [name, p]));
			return { values: resolved };
		}
		if (entry.packageName === 'ffmpeg-static') {
			const p = safeLoadFfmpegPath();
			if (p == null) {
				return {
					values: {},
					error: 'ffmpeg-static binary unavailable',
				};
			}
			const resolved = entry.resolve
				? entry.resolve(p)
				: Object.fromEntries(entry.injects.map((name) => [name, p]));
			return { values: resolved };
		}

		const mod = req(entry.packageName);
		const resolved = entry.resolve
			? entry.resolve(mod)
			: Object.fromEntries(entry.injects.map((name) => [name, defaultExport(mod)]));
		return { values: resolved };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { values: {}, error: message };
	}
}

export { createMissingStub };
