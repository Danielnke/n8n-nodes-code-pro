/**
 * Library registry type definitions.
 */

export interface LibraryEntry {
	/** Inject global name(s) */
	injects: string[];
	/** npm package name */
	packageName: string;
	/**
	 * Lazy-load on first access.
	 * Default true. Set false only for tiny always-used core (default template).
	 */
	lazy?: boolean;
	/** Prefer stub over throw when package missing (still tries load). */
	optional?: boolean;
	/** Map required module → injected value(s). Default: module itself for each inject. */
	resolve?: (mod: unknown) => Record<string, unknown>;
}

export interface LoadLibrariesResult {
	globals: Record<string, unknown>;
	/** All registered inject names (including lazy). */
	loaded: string[];
	failed: Array<{ inject: string; packageName: string; error: string }>;
	/** Registered minus known failures / stubs (optimistic for untouched lazy). */
	availableList: string[];
}
