/**
 * @deprecated Prefer `import { … } from './libraries'`
 * Compatibility re-export for scripts and older imports.
 */
export {
	type LibraryEntry,
	type LoadLibrariesResult,
	LIBRARY_ENTRIES,
	CODE_PRO_MISSING,
	isMissingLibrary,
	defaultExport,
	req,
	createMissingStub,
	safeLoadFfmpegPath,
	safeLoadFfprobePath,
	loadEntry,
	loadLibraryGlobals,
	getLibraryGlobals,
	clearLibraryCache,
	getAllowedRequirePackages,
	REQUIRE_ALIASES,
} from './libraries';
