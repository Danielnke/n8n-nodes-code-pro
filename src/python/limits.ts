/** Limits for the native Python protocol. */

export const PYTHON_PROTOCOL_NAME = 'code-pro-python';
export const PYTHON_PROTOCOL_VERSION = 1;

export const DEFAULT_PYTHON_PROTOCOL_MIB = 10;
export const MIN_PYTHON_PROTOCOL_MIB = 1;
export const MAX_PYTHON_PROTOCOL_MIB = 64;

export const DEFAULT_PYTHON_LOG_KIB = 1024;
export const MIN_PYTHON_LOG_KIB = 64;
export const MAX_PYTHON_LOG_KIB = 4096;

export const DEFAULT_PYTHON_HTTP_RESPONSE_BYTES = 5 * 1024 * 1024;
export const PYTHON_GRACEFUL_KILL_MS = 1500;

function coerceNumber(value: unknown, fallback: number, min: number, max: number): number {
	const numberValue = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(numberValue)) return fallback;
	return Math.min(max, Math.max(min, Math.floor(numberValue)));
}

export function coercePythonProtocolMiB(value: unknown): number {
	return coerceNumber(
		value,
		DEFAULT_PYTHON_PROTOCOL_MIB,
		MIN_PYTHON_PROTOCOL_MIB,
		MAX_PYTHON_PROTOCOL_MIB,
	);
}

export function coercePythonLogKiB(value: unknown): number {
	return coerceNumber(
		value,
		DEFAULT_PYTHON_LOG_KIB,
		MIN_PYTHON_LOG_KIB,
		MAX_PYTHON_LOG_KIB,
	);
}

export function mebibytesToBytes(value: number): number {
	return value * 1024 * 1024;
}

export function kibibytesToBytes(value: number): number {
	return value * 1024;
}
