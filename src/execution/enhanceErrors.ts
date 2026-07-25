/**
 * Human-readable fix hints for common VM / user-code failures.
 */

/** Detect Code Pro / node:vm timeout only — avoid bare "TimeoutError" / generic strings. */
export function isTimeoutError(error: unknown): boolean {
	const err = error as Error & { code?: string; name?: string };
	const message = typeof err?.message === 'string' ? err.message : String(error);
	const code = err?.code;

	// Structured codes we set or node:vm sets
	if (
		code === 'ERR_CODE_PRO_TIMEOUT' ||
		code === 'ERR_SCRIPT_EXECUTION_TIMEOUT'
	) {
		return true;
	}

	// Our soft-timeout / enhanced messages
	if (
		message.includes('Code Pro soft timeout') ||
		message.includes('Code Pro execution timed out')
	) {
		return true;
	}

	// node:vm sync timeout wording (do not match bare "execution timed out")
	if (message.includes('Script execution timed out')) {
		return true;
	}

	// Named TimeoutError only when it is already our enhanced error
	if (err?.name === 'TimeoutError' && code === 'ERR_CODE_PRO_TIMEOUT') {
		return true;
	}

	return false;
}

/**
 * Structured fields for continueOnFail / wrapError consumers.
 */
export function getTimeoutErrorMeta(timeoutSec: number): {
	errorCode: 'TIMEOUT';
	timeoutSec: number;
	description: string;
} {
	const unlimitedHint =
		timeoutSec <= 0
			? 'Soft Timeout is unlimited (0); this is likely the sync VM guard (tight loops) or a host-level kill.'
			: `Options → Timeout is ${timeoutSec}s (per invocation; each-item mode gets a full budget per item). Set Timeout to 0 for unlimited soft race, or raise it for multi-site sitemaps / expands.`;

	return {
		errorCode: 'TIMEOUT',
		timeoutSec,
		description: [
			'Code Pro timed out before your script returned a result.',
			unlimitedHint,
			'Sitemap tips: use utils.sitemap.find / fromWebsite / fromWebsites (parallel probes); timeoutMs is per HTTP request; Mode = Run Once for All Items for batches.',
			'Soft timeout aborts helpers that honor AbortSignal (utils.sitemap HTTP); plain axios without signal may linger briefly.',
		].join(' '),
	};
}

function attachTimeoutMeta(
	out: Error,
	timeoutSec: number,
	cause?: unknown,
): Error & { code?: string; errorCode?: string; timeoutSec?: number } {
	const meta = getTimeoutErrorMeta(timeoutSec);
	const enriched = out as Error & {
		code?: string;
		errorCode?: string;
		timeoutSec?: number;
		cause?: unknown;
	};
	enriched.name = 'TimeoutError';
	enriched.code = 'ERR_CODE_PRO_TIMEOUT';
	enriched.errorCode = meta.errorCode;
	enriched.timeoutSec = timeoutSec;
	if (cause !== undefined && enriched.cause === undefined) {
		try {
			enriched.cause = cause;
		} catch {
			/* ignore non-configurable */
		}
	}
	return enriched;
}

/** Add short fix hints for common VM / user-code failures. */
export function enhanceExecutionError(error: unknown, timeoutSec: number): Error {
	const err = error as Error & { code?: string; name?: string };
	const name = err?.name ?? '';
	const message = typeof err?.message === 'string' ? err.message : String(error);

	if (isTimeoutError(error)) {
		// Preserve an already-rich soft-timeout message; enrich bare VM timeouts
		if (message.includes('Code Pro soft timeout')) {
			return attachTimeoutMeta(new Error(message), timeoutSec, error);
		}
		// Already enhanced once
		if (err.code === 'ERR_CODE_PRO_TIMEOUT' && err.name === 'TimeoutError') {
			return err instanceof Error ? err : new Error(String(error));
		}
		return attachTimeoutMeta(
			new Error(
				`Code Pro execution timed out after ${timeoutSec > 0 ? `${timeoutSec}s` : 'the sync VM guard'} (${timeoutSec > 0 ? 'soft or sync limit' : 'sync VM limit with unlimited soft timeout'}). ` +
					getTimeoutErrorMeta(timeoutSec).description,
			),
			timeoutSec,
			error,
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
