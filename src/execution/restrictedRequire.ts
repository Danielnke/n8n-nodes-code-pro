/**
 * Sandbox-restricted require() for registered packages only.
 */

import {
	getAllowedRequirePackages,
	REQUIRE_ALIASES,
	safeLoadFfmpegPath,
	safeLoadFfprobePath,
} from '../libraries';

export function createRestrictedRequire(loadLibraries: boolean): (name: string) => unknown {
	const allowedPackages = new Set(loadLibraries ? getAllowedRequirePackages() : []);

	return (name: string): unknown => {
		const resolved = REQUIRE_ALIASES[name] ?? name;
		if (!allowedPackages.has(resolved) && !allowedPackages.has(name)) {
			throw new Error(
				`require('${name}') is not allowed in Code Pro. Use injected globals or a registered package (see README library list).`,
			);
		}
		// NEVER bare-require packages that call process.exit on bad platforms
		if (resolved === 'ffprobe-static' || name === 'ffprobe-static') {
			const p = safeLoadFfprobePath();
			if (p == null) {
				throw new Error(
					`require('ffprobe-static') failed: binary unavailable for this platform/arch (or package missing). Prefer ffprobeStatic global.`,
				);
			}
			return { path: p };
		}
		if (resolved === 'ffmpeg-static' || name === 'ffmpeg-static') {
			const p = safeLoadFfmpegPath();
			if (p == null) {
				throw new Error(
					`require('ffmpeg-static') failed: binary unavailable. Prefer ffmpegStatic global or system ffmpeg.`,
				);
			}
			return p;
		}
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		return require(resolved);
	};
}
