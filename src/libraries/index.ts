/**
 * Library injection surface for Code Pro.
 *
 * Layout:
 * - types.ts        — LibraryEntry, LoadLibrariesResult
 * - entries.ts      — LIBRARY_ENTRIES inject table (add packages here)
 * - moduleInterop.ts — defaultExport, missing stubs
 * - safeBinaries.ts — ffmpeg/ffprobe safe paths
 * - loadEntry.ts    — require one entry
 * - registry.ts     — load/cache globals for the sandbox
 * - requireMap.ts   — restricted require() allowlist
 */

export type { LibraryEntry, LoadLibrariesResult } from './types';
export { LIBRARY_ENTRIES } from './entries';
export {
	CODE_PRO_MISSING,
	isMissingLibrary,
	defaultExport,
	req,
	createMissingStub,
} from './moduleInterop';
export { safeLoadFfmpegPath, safeLoadFfprobePath } from './safeBinaries';
export { loadEntry } from './loadEntry';
export {
	loadLibraryGlobals,
	getLibraryGlobals,
	clearLibraryCache,
} from './registry';
export { getAllowedRequirePackages, REQUIRE_ALIASES } from './requireMap';
