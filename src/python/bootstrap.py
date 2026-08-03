"""Code Pro native Python bootstrap.

This is a protocol worker, not a security sandbox. It runs user code with the
same operating-system permissions and environment as the n8n process.
"""

from __future__ import annotations

import asyncio
import base64
import datetime as datetime_module
import importlib.util
import inspect
import json
import math
import os
import ssl
import sys
import traceback
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal
from email.utils import parseaddr
from typing import Any


PROTOCOL = "code-pro-python"
VERSION = 1
USER_FILENAME = "<code-pro-python>"
WRAPPER_LINE_OFFSET = 1
MAX_BOOTSTRAP_INPUT_BYTES = 64 * 1024 * 1024
DEFAULT_USER_AGENT = "Code-Pro-Python/0.6 (+https://www.npmjs.com/package/n8n-nodes-code-pro)"


class ProtocolError(Exception):
    pass


class SerializationError(Exception):
    pass


class AttributeDict(dict):
    """A JSON-compatible dictionary with convenient item.field access."""

    def __getattr__(self, key: str) -> Any:
        try:
            return self[key]
        except KeyError as error:
            raise AttributeError(key) from error

    def __setattr__(self, key: str, value: Any) -> None:
        self[key] = value


def attrify(value: Any) -> Any:
    if isinstance(value, dict):
        return AttributeDict({key: attrify(item) for key, item in value.items()})
    if isinstance(value, list):
        return [attrify(item) for item in value]
    return value


class InputProxy:
    def __init__(self, all_items: list[AttributeDict], current: AttributeDict | None):
        self._all_items = all_items
        self.item = current

    def all(self) -> list[AttributeDict]:
        return self._all_items

    def first(self) -> AttributeDict | None:
        return self._all_items[0] if self._all_items else None


class RedirectLimitHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, max_redirects: int):
        super().__init__()
        self.max_redirects = max_redirects
        self.redirect_count = 0

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        self.redirect_count += 1
        if self.redirect_count > self.max_redirects:
            raise urllib.error.HTTPError(newurl, code, "redirect limit exceeded", headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class PythonUtils:
    def __init__(self, response_byte_limit: int):
        self._response_byte_limit = response_byte_limit

    def get_runtime_info(self) -> AttributeDict:
        return AttributeDict(
            {
                "implementation": sys.implementation.name,
                "version": ".".join(map(str, sys.version_info[:3])),
                "executable": sys.executable,
                "platform": sys.platform,
            }
        )

    def is_package_available(self, name: str) -> bool:
        if not isinstance(name, str) or not name or any(part == "" for part in name.split(".")):
            return False
        try:
            return importlib.util.find_spec(name) is not None
        except (ImportError, ModuleNotFoundError, ValueError):
            return False

    def is_valid_url(self, value: str) -> bool:
        if not isinstance(value, str):
            return False
        parsed = urllib.parse.urlsplit(value)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)

    def is_valid_email(self, value: str) -> bool:
        if not isinstance(value, str) or len(value) > 320:
            return False
        _name, address = parseaddr(value)
        local, separator, domain = address.rpartition("@")
        return separator == "@" and bool(local) and "." in domain and " " not in address

    async def http_get(self, url: str, **kwargs: Any) -> AttributeDict:
        return await self.http_request(url, method="GET", **kwargs)

    async def http_request(
        self,
        url: str,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        data: Any = None,
        timeout: float = 15,
        max_bytes: int | None = None,
        response_type: str = "text",
        max_redirects: int = 5,
    ) -> AttributeDict:
        if not self.is_valid_url(url):
            raise ValueError("http_request requires an absolute http(s) URL")
        if not isinstance(timeout, (int, float)) or not math.isfinite(timeout) or timeout <= 0:
            raise ValueError("http_request timeout must be a positive number of seconds")
        if not isinstance(max_redirects, int) or max_redirects < 0 or max_redirects > 5:
            raise ValueError("http_request max_redirects must be an integer between 0 and 5")
        if response_type not in {"text", "json", "bytes"}:
            raise ValueError("http_request response_type must be 'text', 'json', or 'bytes'")
        byte_limit = self._response_byte_limit if max_bytes is None else min(int(max_bytes), self._response_byte_limit)
        if byte_limit <= 0:
            raise ValueError("http_request max_bytes must be greater than zero")
        return await asyncio.to_thread(
            self._http_request_sync,
            url,
            method,
            headers,
            data,
            float(timeout),
            byte_limit,
            response_type,
            max_redirects,
        )

    def _http_request_sync(
        self,
        url: str,
        method: str,
        headers: dict[str, str] | None,
        data: Any,
        timeout: float,
        max_bytes: int,
        response_type: str,
        max_redirects: int,
    ) -> AttributeDict:
        request_headers = {"User-Agent": DEFAULT_USER_AGENT}
        if headers:
            request_headers.update({str(key): str(value) for key, value in headers.items()})
        body: bytes | None
        if data is None:
            body = None
        elif isinstance(data, bytes):
            body = data
        elif isinstance(data, bytearray):
            body = bytes(data)
        elif isinstance(data, str):
            body = data.encode("utf-8")
        elif isinstance(data, (dict, list)):
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            request_headers.setdefault("Content-Type", "application/json")
        else:
            raise TypeError("http_request data must be bytes, text, a dictionary, a list, or None")

        request = urllib.request.Request(url, data=body, headers=request_headers, method=str(method).upper())
        opener = urllib.request.build_opener(
            RedirectLimitHandler(max_redirects),
            urllib.request.HTTPSHandler(context=ssl.create_default_context()),
        )
        try:
            response = opener.open(request, timeout=timeout)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(max_bytes + 1)
            if len(raw) > max_bytes:
                raise ValueError(f"HTTP response exceeds the {max_bytes} byte limit")
            response_headers = {key: value for key, value in response.headers.items()}
            charset = response.headers.get_content_charset() or "utf-8"
            if response_type == "bytes":
                converted: Any = raw
            else:
                text = raw.decode(charset, errors="replace")
                converted = json.loads(text) if response_type == "json" else text
            return AttributeDict(
                {
                    "status": int(response.getcode()),
                    "headers": AttributeDict(response_headers),
                    "url": response.geturl(),
                    "body": attrify(converted),
                }
            )

    async def retry(
        self,
        callback: Any,
        attempts: int = 3,
        delay: float = 0.2,
        backoff: float = 2,
        max_delay: float = 5,
    ) -> Any:
        if not callable(callback):
            raise TypeError("retry requires a callable")
        if not isinstance(attempts, int) or attempts < 1 or attempts > 20:
            raise ValueError("retry attempts must be an integer between 1 and 20")
        if delay < 0 or backoff < 1 or max_delay < 0:
            raise ValueError("retry delay/backoff values are invalid")
        current_delay = float(delay)
        for attempt in range(attempts):
            try:
                result = callback()
                return await result if inspect.isawaitable(result) else result
            except Exception:
                if attempt == attempts - 1:
                    raise
                await asyncio.sleep(min(current_delay, max_delay))
                current_delay *= backoff
        raise RuntimeError("retry exhausted without returning")


def serialize_value(value: Any, active: set[int] | None = None) -> Any:
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            raise SerializationError("NaN and Infinity cannot be returned as JSON")
        return value
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, (datetime_module.datetime, datetime_module.date, datetime_module.time)):
        return value.isoformat()
    if isinstance(value, (bytes, bytearray)):
        return {"__codeProType": "bytes", "base64": base64.b64encode(bytes(value)).decode("ascii")}

    active = active if active is not None else set()
    value_id = id(value)
    if value_id in active:
        raise SerializationError("Circular structures cannot be returned")
    if isinstance(value, dict):
        active.add(value_id)
        try:
            result: dict[str, Any] = {}
            for key, item in value.items():
                if not isinstance(key, str):
                    raise SerializationError("Returned dictionaries must use string keys")
                result[key] = serialize_value(item, active)
            return result
        finally:
            active.remove(value_id)
    if isinstance(value, (list, tuple)):
        active.add(value_id)
        try:
            return [serialize_value(item, active) for item in value]
        finally:
            active.remove(value_id)
    if isinstance(value, set):
        if not all(item is None or isinstance(item, (str, bool, int, float)) for item in value):
            raise SerializationError("Only sets containing JSON primitive values can be returned")
        converted = [serialize_value(item, active) for item in value]
        return sorted(converted, key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True))
    raise SerializationError(f"Unsupported return type: {type(value).__name__}")


def user_line_from_exception(error: BaseException) -> int | None:
    line = getattr(error, "lineno", None)
    if isinstance(line, int):
        return max(1, line - WRAPPER_LINE_OFFSET)
    for frame in reversed(traceback.extract_tb(error.__traceback__)):
        if frame.filename == USER_FILENAME:
            return max(1, frame.lineno - WRAPPER_LINE_OFFSET)
    return None


def error_payload(error: BaseException, item_index: int | None = None) -> dict[str, Any]:
    user_line = user_line_from_exception(error)
    trace = "".join(traceback.format_exception(type(error), error, error.__traceback__, limit=8)).strip()
    payload: dict[str, Any] = {
        "type": type(error).__name__,
        "message": str(error) or type(error).__name__,
        "traceback": trace[-8000:],
    }
    if user_line is not None:
        payload["userLine"] = user_line
    if item_index is not None:
        payload["itemIndex"] = item_index
    return payload


def compile_user_code(code: str, mode: str):
    if not isinstance(code, str):
        raise TypeError("Python code must be a string")
    args = "_input, _json, _item, _item_index, items, python_utils" if mode == "runOnceForAllItems" else "_input, _json, _item, _item_index, item, python_utils"
    indented = "".join(("    " + line if line.strip() else line) for line in code.splitlines(keepends=True))
    if not indented.strip():
        indented = "    return None\n"
    wrapped = f"async def __code_pro_user({args}):\n{indented}"
    namespace: dict[str, Any] = {}
    compiled = compile(wrapped, USER_FILENAME, "exec")
    exec(compiled, namespace)
    return namespace["__code_pro_user"]


def context_for_all(items: list[AttributeDict], utils: PythonUtils):
    first = items[0] if items else None
    json_value = first.json if len(items) == 1 and first is not None else [item.json for item in items]
    return InputProxy(items, None), json_value, None, None, items, utils


def context_for_item(items: list[AttributeDict], current: AttributeDict, index: int, utils: PythonUtils):
    return InputProxy(items, current), current.json, current, index, current, utils


async def execute_request(request: dict[str, Any]) -> dict[str, Any]:
    if request.get("protocol") != PROTOCOL or request.get("version") != VERSION:
        raise ProtocolError("Unsupported Code Pro Python protocol version")
    mode = request.get("mode")
    if mode not in {"runOnceForAllItems", "runOnceForEachItem"}:
        raise ProtocolError("Unsupported Code Pro execution mode")
    raw_items = request.get("items")
    if not isinstance(raw_items, list):
        raise ProtocolError("Protocol input items must be a list")
    items = [attrify(item) for item in raw_items]
    if not all(isinstance(item, AttributeDict) for item in items):
        raise ProtocolError("Every input item must be an object")
    response_limit = request.get("httpResponseByteLimit", 5 * 1024 * 1024)
    if not isinstance(response_limit, int) or response_limit < 1:
        raise ProtocolError("Invalid HTTP response byte limit")
    user_function = compile_user_code(request.get("code"), mode)
    utils = PythonUtils(response_limit)
    if mode == "runOnceForAllItems":
        result = await user_function(*context_for_all(items, utils))
        return {"protocol": PROTOCOL, "version": VERSION, "ok": True, "result": serialize_value(result)}

    continue_on_fail = bool(request.get("continueOnFail"))
    results: list[dict[str, Any]] = []
    for index, current in enumerate(items):
        try:
            result = await user_function(*context_for_item(items, current, index, utils))
            results.append({"ok": True, "value": serialize_value(result)})
        except Exception as error:
            payload = error_payload(error, index)
            if not continue_on_fail:
                return {"protocol": PROTOCOL, "version": VERSION, "ok": False, "error": payload}
            results.append({"ok": False, "error": payload})
    return {"protocol": PROTOCOL, "version": VERSION, "ok": True, "results": results}


def emit(payload: dict[str, Any], byte_limit: int) -> None:
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
    if len(encoded) > byte_limit:
        encoded = json.dumps(
            {
                "protocol": PROTOCOL,
                "version": VERSION,
                "ok": False,
                "error": {
                    "type": "SerializationError",
                    "message": f"Python protocol output exceeds the configured {byte_limit} byte limit",
                    "traceback": "",
                },
            },
            separators=(",", ":"),
        ).encode("utf-8")
    os.write(PROTOCOL_FD, encoded + b"\n")


PROTOCOL_FD = os.dup(1)
try:
    os.set_inheritable(PROTOCOL_FD, False)
except OSError:
    pass

try:
    LOG_FD = 3
    os.dup2(LOG_FD, 1)
    os.dup2(LOG_FD, 2)
except OSError:
    # The parent will still validate the protocol. This path is only for an
    # unexpectedly constrained host where the separate log pipe is unavailable.
    pass


def main() -> None:
    request_bytes = sys.stdin.buffer.read(MAX_BOOTSTRAP_INPUT_BYTES + 1)
    if len(request_bytes) > MAX_BOOTSTRAP_INPUT_BYTES:
        emit(
            {
                "protocol": PROTOCOL,
                "version": VERSION,
                "ok": False,
                "error": {
                    "type": "ProtocolError",
                    "message": "Python protocol input exceeds the maximum supported size",
                    "traceback": "",
                },
            },
            MAX_BOOTSTRAP_INPUT_BYTES,
        )
        return
    try:
        request = json.loads(request_bytes.decode("utf-8"))
        if not isinstance(request, dict):
            raise ProtocolError("Protocol request must be an object")
        byte_limit = request.get("protocolByteLimit")
        if not isinstance(byte_limit, int) or byte_limit < 1 or byte_limit > MAX_BOOTSTRAP_INPUT_BYTES:
            raise ProtocolError("Invalid Python protocol byte limit")
        response = asyncio.run(execute_request(request))
        emit(response, byte_limit)
    except Exception as error:
        limit = MAX_BOOTSTRAP_INPUT_BYTES
        try:
            limit = int(request.get("protocolByteLimit", limit))  # type: ignore[name-defined]
        except Exception:
            pass
        emit(
            {"protocol": PROTOCOL, "version": VERSION, "ok": False, "error": error_payload(error)},
            max(1024, min(limit, MAX_BOOTSTRAP_INPUT_BYTES)),
        )


if __name__ == "__main__":
    main()
