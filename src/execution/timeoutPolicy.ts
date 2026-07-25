/**
 * Shared timeout coercion + constants for Code Pro soft timeout.
 */

/** Soft timeout UI / runtime max (seconds). */
export const MAX_SOFT_TIMEOUT_SEC = 3600;

/**
 * Sync-only VM guard (ms). Applies even when soft timeout is unlimited,
 * so pure `while(true){}` cannot freeze the n8n process for 5+ minutes.
 * Async work is not covered by this (VM returns a Promise immediately).
 */
export const SYNC_VM_TIMEOUT_MS = 60_000;

export interface NormalizedTimeout {
	/** True when soft Promise.race is disabled. */
	unlimited: boolean;
	/** Soft timeout seconds after coerce (0 if unlimited). */
	timeoutSec: number;
	/** Soft race duration in ms (0 if unlimited). Min 1ms when limited. */
	softTimeoutMs: number;
	/** VM runInContext timeout (sync evaluation only). */
	vmTimeoutMs: number;
}

/**
 * Coerce raw timeout (seconds) the same way at node boundary and runUserCode.
 * - missing / null / non-finite / ≤0 → unlimited (0)
 * - strings like "30" → 30
 * - clamped to [0, MAX_SOFT_TIMEOUT_SEC]
 */
export function coerceTimeoutSec(raw: unknown): number {
	if (raw === undefined || raw === null || raw === '') {
		return 0;
	}
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(n) || n <= 0) {
		return 0;
	}
	return Math.min(MAX_SOFT_TIMEOUT_SEC, n);
}

/** Derive soft/VM timeout policy from a (possibly raw) timeoutSec. */
export function normalizeTimeoutPolicy(rawTimeoutSec: unknown): NormalizedTimeout {
	const timeoutSec = coerceTimeoutSec(rawTimeoutSec);
	const unlimited = timeoutSec <= 0;
	const softTimeoutMs = unlimited ? 0 : Math.max(1, Math.round(timeoutSec * 1000));
	// Soft race and sync VM share the same budget when limited; when unlimited,
	// only the fixed sync guard applies.
	const vmTimeoutMs = unlimited ? SYNC_VM_TIMEOUT_MS : softTimeoutMs;
	return { unlimited, timeoutSec, softTimeoutMs, vmTimeoutMs };
}
