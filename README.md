# Code Pro for n8n

Run trusted JavaScript or native Python in self-hosted n8n. JavaScript keeps Code Pro's stock Code-node helpers and 74 ready-to-use globals; Python 3.11+ adds a focused standard-library runner with matching n8n item semantics.

[![npm version](https://img.shields.io/npm/v/n8n-nodes-code-pro.svg)](https://www.npmjs.com/package/n8n-nodes-code-pro)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.22.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> [!WARNING]
> Code Pro executes trusted code, not a security sandbox. JavaScript runs in n8n and Python runs in a native child process; both can act with the n8n user's filesystem, network, subprocess, environment, credential, and workflow-data access. Python deliberately inherits the complete n8n environment. Install it only on trusted self-hosted instances and run only code you have reviewed.

> **Python security model:** Python is a native subprocess, not an in-process VM and not a sandbox. It inherits the complete n8n environment by design. This does not prevent reviewed code from reading or exfiltrating secrets; keep untrusted code in a separately isolated, least-privilege worker or container.

## Why use Code Pro?

The stock n8n Code node is ideal for lightweight transforms. Code Pro is for self-hosted workflows that need either its broader server-side JavaScript toolbox or a small, operationally bounded native-Python path with the same n8n item behavior.

| You need | Code Pro provides |
|---|---|
| Familiar n8n authoring | JavaScript `$input`, `$json`, `$itemIndex`, `items`, `item`; Python `_input`, `_json`, `_item_index`, `items`, `item`; shared modes, normalization, and linking hints |
| JavaScript automation packages | 74 injected global names backed by 60+ runtime packages |
| Native Python standard library | Python 3.11+ imports plus bounded HTTP, retry, runtime, and package-availability helpers |
| Large or slow jobs | Lazy-loaded heavy libraries, bounded concurrency helpers, output caps, and configurable timeouts |
| Sitemap processing | Discovery through `robots.txt`, XML parsing, gzip support, nested-index expansion, diagnostics, and safety limits |
| Portable examples | Importable n8n workflows for basic transforms, Zod validation, and sitemap discovery |
| Operational visibility | Runtime version and library availability helpers |

## Requirements and compatibility

- Self-hosted n8n. n8n Cloud does not install arbitrary community packages.
- Node.js 22.22.0 or newer.
- Enough disk and memory for the features you use. The package includes an FFmpeg binary and several intentionally large, lazily loaded libraries.
- In n8n queue mode, install the package on every worker that may execute the node.
- JavaScript requires no additional runtime beyond n8n.
- Python requires a native Python 3.11 or newer executable on every n8n main/worker process that can execute Code Pro. Code Pro does not install Python or run pip.
- In n8n queue mode, install both Code Pro and the selected Python runtime on every executing worker. External n8n task runners likewise need a sidecar per worker; they do not provide an isolation boundary for this community node.

Code Pro declares the n8n community-node API v1 and strict package validation. Keep n8n and Code Pro updated together, and test upgrades on a non-production instance first.

## Install

### From the n8n interface

1. Open **Settings → Community Nodes**.
2. Select **Install a community node**.
3. Enter `n8n-nodes-code-pro`.
4. Confirm that you understand the risks of community code.
5. Restart n8n if the **Code Pro** node does not appear immediately.

### From npm

Install the package in the same community-node directory and runtime used by n8n, then restart every n8n process:

```bash
npm install n8n-nodes-code-pro
```

For source development, build this repository and point `N8N_CUSTOM_EXTENSIONS` at its absolute path:

```bash
npm ci
npm run build
```

```powershell
$env:N8N_CUSTOM_EXTENSIONS = "C:\absolute\path\to\n8n-nodes-code-pro"
n8n start
```

## Quick start: choose your language

Code Pro supports both languages in the same node. **Language** defaults to **JavaScript**, so existing workflows keep their current behavior. Select **Python** only when the executing n8n host/worker has Python 3.11+ installed.

| Language | Best for | Starter pattern |
|---|---|---|
| JavaScript | Code Pro's injected automation libraries, existing workflows, and stock `$input`/`$json` conventions | `return $input.all().map((item) => ({ json: item.json }));` |
| Python | Standard-library transforms, async standard-library HTTP, and Python code already available in your worker image | `return [{"json": {"count": len(_input.all())}}]` |

### JavaScript

```js
return $input.all().map((item, index) => ({
  json: { ...item.json, processed: true },
  pairedItem: { item: index },
}));
```

### Python

```python
return [
    {"json": {"name": row.json.name.upper()}, "pairedItem": {"item": index}}
    for index, row in enumerate(_input.all())
]
```

The language-specific references below describe setup and helpers. Both paths use the same modes, output validation, item-linking hints, continue-on-fail behavior, and Max Output Items control.

## Python runtime reference

Select **Language -> Python** in Code Pro. Existing nodes without a `language` value keep running as JavaScript. Python is a focused native-Python MVP: it preserves Code Pro's modes, n8n item contracts, item-linking hints, continue-on-fail behavior, and Max Output Items cap without attempting to duplicate the JavaScript library catalog.

### Runtime selection and deployment

Code Pro requires Python 3.11 or newer and probes executables in this exact order:

1. **Python Runtime -> Python Executable** (an optional per-node absolute path)
2. `CODE_PRO_PYTHON_PATH`
3. `python3`
4. `python`
5. Windows `py -3`

Only a successful interpreter discovery is cached; every node execution starts a fresh Python process. If no compatible runtime is found, Code Pro fails before user code runs and reports each executable checked, the Python 3.11+ requirement, the option/environment variable, Docker guidance, and the queue-worker requirement.

Add Python to the image that actually runs n8n and install the community package there. Choose the command for the base image you use:

```dockerfile
# Alpine-based n8n image
FROM n8nio/n8n:latest
USER root
RUN apk add --no-cache python3
USER node
```

```dockerfile
# Debian/Ubuntu-based custom n8n image
FROM your-n8n-base-image
USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3 \
  && rm -rf /var/lib/apt/lists/*
USER node
```

In queue mode, **every worker that can execute Code Pro must have both this package and the chosen Python runtime**. Restart all main/worker containers after an image change. n8n's external task-runner configuration also requires a runner sidecar for every worker; use it or a separate least-privilege worker/container for untrusted Code-node workloads, not as a claim that Code Pro itself sandboxes Python.

### Python authoring and return values

Python code is compiled once into an async function for a node invocation, so top-level-style `return` and `await` work. In each-item mode, that compiled function is called for every input item in the same Python child process.

| Python name | Meaning |
|---|---|
| `_input.all()` / `_input.first()` | Full input list / first input in both modes |
| `_input.item` | Current input item in each-item mode |
| `_json`, `_item`, `_item_index` | Current JSON, full item, and zero-based index in each-item mode |
| `items` | Full input list in all-items mode |
| `item` | Current full input item in each-item mode |
| `python_utils` | Focused runtime, package, HTTP, retry, URL, and email helpers |

Items support serializable attribute access such as `item.json.name` and `item.binary.attachment`; dictionary access also works. JSON `null` becomes Python `None`, and Unicode, nested dictionaries/lists, booleans, and numbers round-trip unchanged.

| Mode | Python return contract |
|---|---|
| Run Once for All Items | Return a list of n8n items. Plain dictionaries are normalized to `{ "json": ... }` like JavaScript. |
| Run Once for Each Item | Return one dictionary or a one-element list. Return `None` or `[]` to skip that input. More than one output item is rejected with the existing Code Pro validation error. |

Use `pairedItem` when you create, remove, reorder, or aggregate output items. Python results cross back into the same Node.js normalization, validation, item-linking hint, continue-on-fail, and Max Output Items logic as JavaScript.

```python
# Run Once for All Items
rows = _input.all()

return [
    {
        "json": {"name": row.json.name.upper()},
        "pairedItem": {"item": index},
    }
    for index, row in enumerate(rows)
]
```

```python
# Run Once for Each Item
if not _json.active:
    return None

return {"json": {"name": item.json.name, "index": _item_index}}
```

### Python utilities and imports

Normal standard-library imports use the selected interpreter. The MVP intentionally does not bundle Python, pandas, NumPy, `requests`, or any third-party Python package, and Code Pro never installs packages or invokes pip at workflow runtime. A third-party import may work only when it is already installed in the selected interpreter environment.

| Helper | Purpose |
|---|---|
| `python_utils.get_runtime_info()` | Interpreter implementation, version, executable, and platform |
| `python_utils.is_package_available(name)` | Check whether an importable package is present without importing it |
| `await python_utils.http_get(url, ...)` | Bounded standard-library GET request |
| `await python_utils.http_request(url, method="POST", data=..., ...)` | Bounded standard-library HTTP request |
| `await python_utils.retry(callback, attempts=3, delay=0.2, backoff=2)` | Retries sync or async callbacks |
| `python_utils.is_valid_url(value)` / `is_valid_email(value)` | Basic structural checks only; they are not sanitizers |

`http_get()` and `http_request()` use the standard library, follow at most five redirects, use normal TLS certificate verification, set a Code Pro user agent, default to a 15-second request timeout, and retain at most 5 MiB of each response. A caller may lower `max_bytes` but cannot disable the 5 MiB ceiling. `response_type` is `"text"`, `"json"`, or `"bytes"`.

```python
response = await python_utils.http_get(
    "https://api.example.test/status",
    timeout=8,
    max_bytes=256_000,
    response_type="json",
)

return [{"json": {"status": response.status, "body": response.body}}]
```

### Serialization and limits

Python return values may contain dictionaries with string keys, lists, tuples, strings, integers, finite floats, booleans, and `None`. `datetime`, `date`, and `time` become ISO strings; `Decimal` becomes a string; `bytes` and `bytearray` become `{ "__codeProType": "bytes", "base64": "..." }`; primitive-only sets become a deterministic list. Circular structures, non-finite floats, non-string dictionary keys, complex sets, and unsupported objects fail with a clear serialization error.

The node exposes **Max Python Protocol Size** (default 10 MiB, 1-64 MiB) and **Max Python Log Output** (default 1 MiB, 64 KiB-4 MiB). Input JSON, the final protocol response, captured stdout/stderr, and HTTP response bodies are bounded. `print()` is captured separately from the machine-readable response, so it cannot corrupt node output. Avoid logging secrets: values that exactly match inherited environment values are redacted in surfaced Python logs and errors, but trusted code can still deliberately read or exfiltrate its host access.

### Timeouts, cleanup, and troubleshooting

`Timeout = 0` remains unlimited. For Python, a positive Timeout is a wall-clock **hard timeout for the entire child process and each-item batch**. Code Pro terminates the Python process tree, waits at most 1.5 seconds for graceful shutdown, then force-kills it. JavaScript keeps its existing cooperative/in-process timeout behavior; do not describe the JavaScript boundary as a hard process kill.

Python process startup adds a native interpreter cold start, usually hundreds of milliseconds on a typical worker but dependent on the image, CPU, and installed environment. Code Pro compiles once per invocation and does not retain Python state or child references after success, failure, cancellation, or timeout.

| Problem | Check |
|---|---|
| Python unavailable | Read the reported executable list; install Python 3.11+, set Python Executable or `CODE_PRO_PYTHON_PATH`, then restart the executing service. |
| Works on main but not queue | Rebuild/restart every worker image and verify the same executable there. |
| Missing import | Use the standard library or install the reviewed dependency into the selected interpreter during image build, never from a workflow. |
| Protocol/log limit error | Reduce input, returned data, or prints; then raise the Python-only cap deliberately if needed. |
| Untrusted code requirement | Move the workload to an isolated, least-privilege worker/container or use n8n's externally managed runner architecture. |

## JavaScript quick start

Add **Code Pro**, keep **Run Once for All Items**, and replace the editor contents with:

```js
const rows = $input.all().map((input) => input.json);

return rows.map((row, index) => ({
  json: {
    ...row,
    id: uuid.v4(),
    processedAt: dayjs().toISOString(),
  },
  pairedItem: { item: index },
}));
```

Libraries are injected as globals, so use `uuid`, `dayjs`, `_`, `axios`, or `z` directly. A restricted `require()` is available for registered packages, but the injected globals are the simplest and most portable interface.

## Execution model

| Setting | Contract |
|---|---|
| **Run Once for All Items** | Runs once. Return an array of n8n items. Best for batching, fan-out, joins, and sitemap work. |
| **Run Once for Each Item** | Runs once per input. Return one item, a one-element array, `null`, `undefined`, or an empty array. Empty results skip that input. |
| **Timeout** | `0` disables the async soft timeout. A positive value races asynchronous work and aborts sitemap HTTP requests that honor the execution signal. |
| **Max Output Items** | Defaults to 10,000 and is fail-closed. Invalid values fall back to the default; the maximum configurable cap is 1,000,000. |

Synchronous evaluation always has a 60-second VM guard when Timeout is `0`. A positive Timeout also becomes the synchronous VM budget. Asynchronous CPU loops resumed after an `await` cannot be forcibly stopped inside the n8n process; avoid CPU-bound or untrusted code.

Use `pairedItem` whenever output counts or ordering differ from the input so downstream expressions preserve item lineage.

## Everyday recipes

### Validate input with Zod

```js
const schema = z.object({
  email: z.string().email(),
  active: z.boolean().default(true),
});

return $input.all().map((input, index) => ({
  json: schema.parse(input.json),
  pairedItem: { item: index },
}));
```

### Make bounded HTTP requests

```js
const urls = $input.all().map((input) => String(input.json.url));

const results = await utils.mapPool(urls, 4, async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 10_000,
      responseType: "text",
    });
    return { url, ok: true, status: response.status };
  } catch (error) {
    return { url, ok: false, error: error.message };
  }
});

return results.map((json, index) => ({
  json,
  pairedItem: { item: index },
}));
```

### Parse CSV

```js
const parsed = Papa.parse(String($json.csv), {
  header: true,
  skipEmptyLines: true,
});

return parsed.data.map((json) => ({ json }));
```

### Create an Excel workbook

```js
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Data");
sheet.columns = [
  { header: "Name", key: "name" },
  { header: "Email", key: "email" },
];
sheet.addRows($input.all().map((input) => input.json));

const buffer = await workbook.xlsx.writeBuffer();
return [{ json: { bytes: buffer.byteLength } }];
```

### Resize an image with Jimp

```js
const image = await Jimp.read(imageBuffer);
image.resize({ w: 320 });
const resized = await image.getBuffer(JimpMime.png);
```

Code Pro also keeps common Jimp 0.x calls such as `resize(width, height)` and `getBufferAsync()` working while using Jimp 1.x.

## Included libraries

Heavy packages are loaded on first use. Aliases in the same row refer to the same package.

| Area | Globals |
|---|---|
| Data and IDs | `_`, `lodash`, `bytes`, `ms`, `qs`, `uuid`, `nanoid`, `utils` |
| Dates and schedules | `dayjs`, `moment`, `dateFns`, `dateFnsTz`, `luxon`, `DateTime`, `cronParser` |
| Validation | `joi`, `Joi`, `yup`, `z`, `zod`, `Ajv`, `validator`, `phoneNumber`, `iban` |
| CSV, XML, and config | `Papa`, `papaparse`, `xml2js`, `XMLParser`, `XMLBuilder`, `YAML`, `ini`, `toml`, `jmespath`, `jsonDiff` |
| HTML and text | `cheerio`, `htmlToText`, `marked`, `Handlebars`, `slug`, `pluralize`, `fuzzy`, `stringSimilarity`, `franc`, `compromise` |
| Crypto and authentication | `CryptoJS`, `nodeCrypto`, `forge`, `jwt`, `bcrypt`, `bcryptjs`, `secp256k1`, `bip39` |
| HTTP | `axios`, `FormData`, `pRetry` |
| Documents and archives | `ExcelJS`, `JSZip`, `pako`, `QRCode` |
| Images | `Jimp`, `jimp`, `JimpMime`, `imageSize`, `exifr`, `JPEG`, `PNG` |
| Video and media | `ffmpeg`, `ffmpegStatic`, `ytdl` |
| Blockchain and trading | `web3`, `ccxt`, `coinGecko`, `solana`, `bitcoin` |

Full injected-name inventory:

```text
utils, _, lodash, bytes, ms, qs, uuid, nanoid, dayjs, moment, dateFns,
dateFnsTz, luxon, DateTime, cronParser, joi, Joi, validator, Ajv, yup, z,
zod, phoneNumber, iban, xml2js, XMLParser, XMLBuilder, YAML, papaparse,
Papa, ini, toml, jmespath, jsonDiff, cheerio, Handlebars, htmlToText,
marked, slug, pluralize, fuzzy, stringSimilarity, franc, compromise,
CryptoJS, forge, jwt, bcrypt, bcryptjs, nodeCrypto, secp256k1, bip39,
axios, FormData, pRetry, ExcelJS, JSZip, pako, QRCode, Jimp, jimp,
JimpMime, imageSize, exifr, JPEG, PNG, web3, ccxt, coinGecko, solana,
bitcoin, ytdl, ffmpeg, ffmpegStatic
```

Inspect the running installation instead of relying on a static list:

```js
return [{
  json: {
    version: utils.getCodeProVersion(),
    registered: utils.getRegisteredLibraries(),
    available: utils.getAvailableLibraries(),
    failed: utils.getFailedLibraries(),
  },
}];
```

`getAvailableLibraries()` is optimistic for lazy libraries until they are first loaded. Use `utils.isLibraryAvailable("Jimp")` after loading a feature when availability matters.

## Sitemap toolkit

`utils.sitemap` handles the repetitive and failure-prone parts of sitemap workflows.

| Method | Purpose |
|---|---|
| `find(website, options?)` | Check `robots.txt` and common paths, fetch the first valid sitemap, and return diagnostics |
| `parse(xml)` | Parse a sitemap `urlset` or `sitemapindex` without a network request |
| `expand(urlOrXml, options?)` | Walk nested sitemap indexes and return page URLs |
| `fromWebsite(website, options?)` | Discover one site and optionally expand it |
| `fromWebsites(websites, options?)` | Process several sites with bounded website concurrency |

### Discover several sites

```js
const websites = $input.all().map(
  (input) => input.json.website || input.json.Website,
);

const results = await utils.sitemap.fromWebsites(websites, {
  expand: false,
  includeRawXml: true,
  websiteConcurrency: 3,
  concurrency: 4,
  timeoutMs: 8_000,
});

return results.map((json, index) => ({
  json,
  pairedItem: { item: index },
}));
```

### Expand to one item per page URL

```js
const result = await utils.sitemap.fromWebsite($json.website, {
  expand: true,
  maxDepth: 3,
  maxSitemaps: 50,
  maxUrls: 5_000,
});

if (!result.found) {
  return [{ json: {
    website: $json.website,
    found: false,
    attempts: result.attempts,
  } }];
}

return result.urls.map((loc) => ({
  json: {
    loc,
    sourceUrl: result.sourceUrl,
    truncated: result.truncated,
  },
}));
```

Expansion is opt-in. URL results are strings unless `includeMetadata: true`. Raw XML is omitted during expansion unless `includeRawXml: true`.

Safety limits include:

- 20 MiB default per sitemap response, configurable with `maxContentBytes` up to the 50 MiB sitemap-protocol ceiling.
- 1 MiB maximum `robots.txt` response.
- Bounded request concurrency (maximum 16) and website concurrency (maximum 8).
- Maximums of 500 sitemaps, depth 10, and 1,000,000 URLs.
- Candidate and robots-declaration caps, gzip decompression limits, URL canonicalization, and generic-XML rejection.
- Diagnostic attempt reasons including `not_xml`, `too_large`, `http_error`, `timeout`, and `network`.

`timeoutMs` is per HTTP request; the node’s **Timeout** applies to the whole invocation.

## Built-in `utils`

Frequently useful helpers include:

- `utils.mapPool(items, concurrency, fn)` — order-preserving bounded async mapping.
- `utils.retry(fn, options)` — retry with bounded attempts and tracked delays.
- `utils.sleep(ms)` — a delay cleaned up when the invocation ends.
- `utils.flatten(value)` — flatten nested objects.
- `utils.isEmail(value)` and `utils.isUrl(value)` — lightweight checks.
- `utils.sanitizeInput(value)` — basic string cleanup only. It is not HTML/XSS sanitization or SQL escaping.
- `utils.memoryUsage()` — a snapshot of Node.js process memory.
- Library inventory and Code Pro version helpers shown above.

Invocation-created timers are tracked and cleared on completion to avoid leaking background intervals into later executions.

## Security and operations

Code Pro uses Node's `vm` module for execution context ergonomics. Node explicitly does not treat `vm` as a security mechanism, and neither does Code Pro.

- Never run code supplied by webhook callers, form users, tenants, or an AI agent without human review.
- Assume scripts can read environment secrets, access mounted files, make network requests, launch subprocesses, and affect the n8n process.
- Apply least-privilege container users, read-only mounts where practical, network egress controls, and narrowly scoped credentials at the n8n deployment level.
- Keep the node unavailable to untrusted workflow editors.
- Prefer isolated worker/container boundaries for risky or resource-intensive jobs.
- Avoid unbounded `Promise.all`, large in-memory buffers, and returning raw sitemap XML unless a downstream node needs it.
- Review community-node updates before deploying them.

The bundled `fluent-ffmpeg` package is deprecated upstream. It remains for compatibility; for new high-assurance media workflows, consider calling a maintained FFmpeg wrapper or an isolated media service. `ffmpegStatic` supplies the bundled FFmpeg path. Install a system `ffprobe` and configure `ffmpeg.setFfprobePath(...)` if probing is required.

## Importable examples

The npm package includes:

- `examples/code-pro-basic.json` — enrich and preserve item linking.
- `examples/code-pro-validate-zod.json` — validate data with Zod.
- `examples/code-pro-sitemap.json` — discover and inspect sitemaps.

Import a file through **Workflows → Import from File**, inspect its code, then replace the sample input with your own data.

## Upgrading to 0.5

Version 0.5 raises the runtime requirement to Node.js 22.22.0 and removes two problematic globals:

- `XLSX` / `xlsx`: removed because the npm `xlsx` release line has unresolved security advisories. Use `ExcelJS`.
- `ffprobeStatic`: removed to reduce the installed footprint. Install system `ffprobe` when needed.

Jimp is upgraded to 1.x with compatibility adapters for common 0.x methods. Test image and media workflows before production rollout.

Upgrade with:

```bash
npm install n8n-nodes-code-pro@latest
```

Restart every n8n main and worker process, then confirm the loaded version with `utils.getCodeProVersion()`.

## Troubleshooting

**Code Pro does not appear**

- Confirm the package is installed in the n8n instance's community-node directory.
- Restart all n8n processes.
- In queue mode, verify every worker has the same package version.
- Check startup logs for community-node validation or dependency errors.

**A library says it is unavailable**

Run the inventory snippet above and inspect `utils.getFailedLibraries()`. Lazy libraries are tested only when first accessed. Check the host architecture, binary availability, and install logs.

**A workflow times out**

`Timeout` is per Code Pro invocation. Raise it or use `0` for intentionally long async work, and set explicit timeouts on network requests. A timeout is cooperative for async/native work, not a process-level kill switch.

**Output exceeds Max Output Items**

Reduce fan-out, lower sitemap `maxUrls`, or batch the work. Raise the cap only after checking worker memory.

**FFmpeg or ffprobe fails**

Verify `ffmpegStatic`, or install system binaries and set paths with `ffmpeg.setFfmpegPath(...)` and `ffmpeg.setFfprobePath(...)`.

For reproducible bug reports, include the n8n version, Node.js version, Code Pro version, deployment mode, platform/architecture, a minimal workflow, and relevant logs with secrets removed.

## Development

```bash
npm ci
npm run verify
npm pack --dry-run
```

`npm run verify` performs TypeScript checks, a clean build, execution-contract tests, sitemap tests, an n8n execution simulation, library loading smoke tests, and functional library checks.

See `scripts/live-n8n-checklist.md` for the manual n8n acceptance checklist.

## Support and license

Report defects and request features through [GitHub Issues](https://github.com/Danielnke/n8n-nodes-code-pro/issues).

Code Pro is released under the [MIT License](LICENSE).
