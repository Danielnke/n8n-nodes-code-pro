/**
 * HTTP fetch helpers for sitemap XML (gzip-aware).
 */

import { gunzipSync } from 'node:zlib';
import { detectKind, looksLikeXml, stripBom, suggestsGzip } from './detect';
import { DEFAULT_ROBOTS_MAX_BYTES, normalizeSitemapByteLimit, normalizeTimeoutMs } from './limits';
import { resolveSitemapSignal } from './signal';
import type { AttemptReason, AxiosLike } from './types';

export const DEFAULT_BROWSER_HEADERS: Record<string, string> = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 CodePro/sitemap',
	Accept: 'application/xml,text/xml,application/xhtml+xml,text/plain,*/*;q=0.8',
	'Accept-Encoding': 'gzip, deflate, br',
};

export interface FetchXmlResult {
	ok: boolean;
	url: string;
	status?: number;
	text: string | null;
	reason?: AttemptReason;
	message?: string;
}

function headerGet(
	headers: Record<string, unknown> | undefined,
	name: string,
): string | undefined {
	if (!headers) return undefined;
	const lower = name.toLowerCase();
	for (const [k, v] of Object.entries(headers)) {
		if (k.toLowerCase() === lower) {
			if (Array.isArray(v)) return String(v[0] ?? '');
			return v == null ? undefined : String(v);
		}
	}
	return undefined;
}

function bufferFromData(data: unknown): Buffer | null {
	if (data == null) return null;
	if (Buffer.isBuffer(data)) return data;
	if (data instanceof ArrayBuffer) return Buffer.from(data);
	if (ArrayBuffer.isView(data)) {
		const view = data as ArrayBufferView;
		return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
	}
	if (typeof data === 'string') return Buffer.from(data, 'binary');
	return null;
}

function isTooLargeError(error: unknown): boolean {
	const e = error as { code?: string; message?: string };
	const message = e?.message ?? String(error);
	return (
		e?.code === 'ERR_BUFFER_TOO_LARGE' ||
		e?.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' ||
		/maxcontentlength|maxoutputlength|larger than|too large/i.test(message)
	);
}

function decodeBody(
	url: string,
	data: unknown,
	headers: Record<string, unknown> | undefined,
	maxContentBytes: number,
): { text: string | null; reason?: AttemptReason; message?: string } {
	const contentType = headerGet(headers, 'content-type');
	const contentEncoding = headerGet(headers, 'content-encoding');
	const wantGzip = suggestsGzip(url, contentType, contentEncoding);

	const tooLarge = () => ({
		text: null,
		reason: 'too_large' as const,
		message: 'Response exceeds the configured sitemap byte limit',
	});

	const decodeGzip = (buf: Buffer) => {
		if (buf.byteLength > maxContentBytes) return tooLarge();
		try {
			const inflated = gunzipSync(buf as unknown as Uint8Array, { maxOutputLength: maxContentBytes });
			if (inflated.byteLength > maxContentBytes) return tooLarge();
			return { text: stripBom(inflated.toString('utf8')) };
		} catch (error) {
			if (isTooLargeError(error)) return tooLarge();
			const message = error instanceof Error ? error.message : String(error);
			const asText = stripBom(buf.toString('utf8'));
			if (looksLikeXml(asText) && Buffer.byteLength(asText, 'utf8') <= maxContentBytes) {
				return { text: asText };
			}
			return { text: null, reason: 'gzip_error' as const, message };
		}
	};

	if (typeof data === 'string') {
		const hasGzipMagic =
			data.length >= 2 && data.charCodeAt(0) === 0x1f && data.charCodeAt(1) === 0x8b;
		if (wantGzip || hasGzipMagic) {
			return decodeGzip(Buffer.from(data, 'binary'));
		}
		if (Buffer.byteLength(data, 'utf8') > maxContentBytes) return tooLarge();
		return { text: stripBom(data) };
	}

	const buf = bufferFromData(data);
	if (!buf) {
		return { text: null, reason: 'empty', message: 'empty response body' };
	}
	if (buf.byteLength > maxContentBytes) return tooLarge();

	const isGzipMagic = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
	if (wantGzip || isGzipMagic) return decodeGzip(buf);

	return { text: stripBom(buf.toString('utf8')) };
}

function classifyAxiosError(err: unknown): {
	reason: AttemptReason;
	status?: number;
	message: string;
} {
	const e = err as {
		code?: string;
		message?: string;
		name?: string;
		response?: { status?: number };
	};
	const msg = e?.message ?? String(err);
	if (isTooLargeError(err)) {
		return { reason: 'too_large', message: msg };
	}
	if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || /aborted|canceled/i.test(msg)) {
		return { reason: 'aborted', message: msg };
	}
	if (e?.code === 'ECONNABORTED' || /timeout/i.test(msg)) {
		return { reason: 'timeout', message: msg };
	}
	const status = e?.response?.status;
	if (typeof status === 'number') {
		return { reason: 'http_error', status, message: msg };
	}
	if (
		e?.code === 'ENOTFOUND' ||
		e?.code === 'ECONNREFUSED' ||
		e?.code === 'ECONNRESET' ||
		e?.code === 'EAI_AGAIN' ||
		e?.code === 'CERT_HAS_EXPIRED' ||
		e?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
	) {
		return { reason: 'network', message: msg };
	}
	return { reason: 'network', message: msg };
}

/**
 * Fetch a URL and return decoded text if it looks like sitemap XML.
 */
export async function fetchSitemapXml(
	axios: AxiosLike,
	url: string,
	options: {
		timeoutMs?: number;
		maxContentBytes?: number;
		headers?: Record<string, string>;
		signal?: AbortSignal;
	} = {},
): Promise<FetchXmlResult> {
	const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
	const maxContentBytes = normalizeSitemapByteLimit(options.maxContentBytes);
	const headers = { ...DEFAULT_BROWSER_HEADERS, ...options.headers };
	const preferBinary = suggestsGzip(url);
	const signal = resolveSitemapSignal(options.signal);

	try {
		const res = await axios.get(url, {
			timeout: timeoutMs,
			headers,
			responseType: preferBinary ? 'arraybuffer' : 'text',
			// Accept 2xx and 3xx; reject 4xx/5xx so we can classify
			validateStatus: (s: number) => s >= 200 && s < 400,
			signal,
			// Follow redirects (axios default)
			maxRedirects: 5,
			maxContentLength: maxContentBytes,
			maxBodyLength: maxContentBytes,
			// Decompress gzip content-encoding when possible; we still handle .gz files
			decompress: true,
		});

		const status = res.status;
		const decoded = decodeBody(
			url,
			res.data,
			res.headers as Record<string, unknown> | undefined,
			maxContentBytes,
		);
		if (decoded.reason && !decoded.text) {
			return {
				ok: false,
				url,
				status,
				text: null,
				reason: decoded.reason,
				message: decoded.message,
			};
		}
		const text = decoded.text;
		if (!text || !text.trim()) {
			return { ok: false, url, status, text: null, reason: 'empty', message: 'empty body' };
		}
		const kind = detectKind(text);
		if (!looksLikeXml(text) || (kind !== 'urlset' && kind !== 'sitemapindex')) {
			return {
				ok: false,
				url,
				status,
				text: null,
				reason: 'not_xml',
				message: 'response does not contain a sitemap urlset or sitemapindex root',
			};
		}
		return { ok: true, url, status, text, reason: 'ok' };
	} catch (err) {
		const c = classifyAxiosError(err);
		return {
			ok: false,
			url,
			status: c.status,
			text: null,
			reason: c.reason,
			message: c.message,
		};
	}
}

/**
 * Fetch robots.txt (or any text) without requiring XML.
 */
export async function fetchText(
	axios: AxiosLike,
	url: string,
	options: {
		timeoutMs?: number;
		maxContentBytes?: number;
		headers?: Record<string, string>;
		signal?: AbortSignal;
	} = {},
): Promise<{ ok: boolean; status?: number; text: string | null; reason?: AttemptReason; message?: string }> {
	const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
	const maxContentBytes = Math.min(
		DEFAULT_ROBOTS_MAX_BYTES,
		normalizeSitemapByteLimit(options.maxContentBytes),
	);
	const headers = {
		...DEFAULT_BROWSER_HEADERS,
		Accept: 'text/plain,*/*;q=0.8',
		...options.headers,
	};
	const signal = resolveSitemapSignal(options.signal);
	try {
		const res = await axios.get(url, {
			timeout: timeoutMs,
			headers,
			responseType: 'text',
			validateStatus: (s: number) => s >= 200 && s < 400,
			signal,
			maxRedirects: 5,
			maxContentLength: maxContentBytes,
			maxBodyLength: maxContentBytes,
		});
		const text = typeof res.data === 'string' ? res.data : String(res.data ?? '');
		if (Buffer.byteLength(text, 'utf8') > maxContentBytes) {
			return {
				ok: false,
				status: res.status,
				text: null,
				reason: 'too_large',
				message: 'robots.txt exceeds the configured byte limit',
			};
		}
		return { ok: true, status: res.status, text };
	} catch (err) {
		const c = classifyAxiosError(err);
		return {
			ok: false,
			status: c.status,
			text: null,
			reason: c.reason,
			message: c.message,
		};
	}
}
