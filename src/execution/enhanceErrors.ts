/**
 * Human-readable fix hints for common VM / user-code failures.
 */

/** Add short fix hints for common VM / user-code failures. */
export function enhanceExecutionError(error: unknown, timeoutSec: number): Error {
	const err = error as Error & { code?: string; name?: string };
	const name = err?.name ?? '';
	const message = typeof err?.message === 'string' ? err.message : String(error);

	if (
		message.includes('Script execution timed out') ||
		err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT'
	) {
		return new Error(
			`Code Pro execution timed out after ${timeoutSec}s (sync VM limit). Reduce work or increase Options → Timeout.`,
		);
	}

	// Use .name — VM cross-realm errors may fail `instanceof SyntaxError`
	if (name === 'SyntaxError' || error instanceof SyntaxError) {
		return new Error(
			`Code Pro SyntaxError: ${message}. Check for truncated paste, unmatched braces/parens, or incomplete statements.`,
		);
	}

	if (name === 'ReferenceError' || error instanceof ReferenceError) {
		return new Error(
			`Code Pro ReferenceError: ${message}. If this names a library, confirm it is in the inject list (utils.getRegisteredLibraries()) and not failed (utils.getFailedLibraries()). Rebuild/restart n8n if you just installed packages.`,
		);
	}

	if (name === 'TypeError' || error instanceof TypeError) {
		return new Error(
			`Code Pro TypeError: ${message}. Check that the value exists and is the expected type (e.g. axios is a function with .get).`,
		);
	}

	return err instanceof Error ? err : new Error(String(error));
}
