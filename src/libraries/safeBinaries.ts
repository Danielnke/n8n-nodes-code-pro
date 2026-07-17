/**
 * Safe loaders for ffmpeg/ffprobe static binaries.
 * CRITICAL: ffprobe-static can call process.exit(1) on bad platforms — never bare-require without precheck.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';

/**
 * ffprobe-static calls process.exit(1) on unsupported platform/arch at require time.
 * Never require it without this precheck.
 */
export function safeLoadFfprobePath(): string | null {
	const platform = os.platform();
	const arch = os.arch();
	if (platform !== 'darwin' && platform !== 'linux' && platform !== 'win32') {
		return null;
	}
	if (platform === 'darwin' && arch !== 'x64' && arch !== 'arm64') {
		return null;
	}
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const probe = require('ffprobe-static') as { path?: string };
		const p = probe?.path;
		if (typeof p === 'string' && fs.existsSync(p)) {
			return p;
		}
	} catch {
		/* optional binary package */
	}
	return null;
}

export function safeLoadFfmpegPath(): string | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const ffPath = require('ffmpeg-static') as string | null;
		if (typeof ffPath === 'string' && fs.existsSync(ffPath)) {
			return ffPath;
		}
	} catch {
		/* optional binary package */
	}
	return null;
}
