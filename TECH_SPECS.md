# Technical Specifications: Code Pro (`n8n-nodes-code-pro`)

> **Status:** Draft v0.3 · 2026-07-16 — **implementation-ready**  
> **Identity locked.** Library target: **SuperCode 55+ parity + Code Pro extras**.  
> Related: `AGENTS.md`, `PROJECT_PLAN.md`.

---

## 1. Purpose and scope

### 1.1 Purpose

**Code Pro** is a self-hosted n8n community node that:

1. Executes user **JavaScript** on the main I/O path.
2. Matches **stock Code** modes, helpers (MVP→full), and return semantics.
3. Injects a **SuperCode-class library surface** (advertised 55+ globals) so automation code is not stuck on vanilla JS / allowlists.
4. Lets the **package owner** add libraries by changing this repo (not n8n host env vars).

### 1.2 In scope

- Package `n8n-nodes-code-pro`, node `codePro` / Code Pro  
- Full SuperCode inject-name parity  
- Code Pro extras  
- Timeouts, validation, docs for every symbol  

### 1.3 Out of scope

- Python  
- n8n verified/Cloud fat-package listing  
- Multi-tenant hard isolation  

---

## 2. Identity (normative)

| Field | Value |
|---|---|
| npm package | `n8n-nodes-code-pro` |
| Node class | `CodePro` |
| File | `nodes/CodePro/CodePro.node.ts` |
| `name` | `codePro` |
| Full type | `n8n-nodes-code-pro.codePro` |
| `displayName` | `Code Pro` |
| `group` | `['transform']` |
| `version` | `1` |
| inputs / outputs | main / main |
| credentials | none (MVP) |
| `parameterPane` | `wide` |
| icon | `file:codepro.svg` (or png) |

### 2.1 package.json sketch

```json
{
  "name": "n8n-nodes-code-pro",
  "version": "0.1.0",
  "description": "Code Pro — JavaScript Code node for n8n with 55+ automation libraries (SuperCode-class surface, stock-compatible)",
  "keywords": [
    "n8n-community-node-package",
    "n8n",
    "javascript",
    "code",
    "code-pro",
    "automation",
    "libraries"
  ],
  "license": "MIT",
  "engines": { "node": ">=20" },
  "n8n": {
    "n8nNodesApiVersion": 1,
    "nodes": ["dist/nodes/CodePro/CodePro.node.js"],
    "credentials": []
  },
  "files": ["dist"],
  "peerDependencies": { "n8n-workflow": "*" }
}
```

---

## 3. System context

```text
n8n main/worker
  └─ community package n8n-nodes-code-pro
       ├─ dependencies (lodash, axios, … web3, ccxt, …)
       └─ CodePro.execute()
            context = helpers + libraryRegistry
            run(userJs) → validate → INodeExecutionData[][]
```

Community package deps resolve **without** `NODE_FUNCTION_ALLOW_EXTERNAL`.

---

## 4. Node UI parameters

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `mode` | options | `runOnceForAllItems` | `runOnceForAllItems` \| `runOnceForEachItem` |
| `jsCode` | string + `jsEditor` | SuperCode-style banner + Code Pro extras | See §4.1 |
| `timeout` | number (seconds) | `30` | Hard best-effort abort |
| `maxOutputItems` | number | e.g. `10000` | Cap explosion |
| `continueOnFail` | use n8n standard where available | — | Per-item errors |

No language selector (JS only).

### 4.1 Default code template (required content)

Default editor text **must** list available libraries (port SuperCode’s discoverability):

```javascript
// Code Pro (n8n-nodes-code-pro) — 55+ JavaScript libraries (SuperCode-parity + extras)
// SuperCode-parity: _, lodash, axios, cheerio, dayjs, moment, dateFns, dateFnsTz,
//   joi, Joi, validator, uuid, Ajv, yup, xml2js, XMLParser, YAML, papaparse, Papa,
//   Handlebars, CryptoJS, forge, jwt, bcrypt, bcryptjs, XLSX, QRCode, fuzzy,
//   stringSimilarity, slug, pluralize, qs, FormData, ini, toml, nanoid, bytes,
//   phoneNumber, iban, web3, ytdl, ffmpeg, ffmpegStatic, utils, ccxt, coinGecko,
//   solana, bitcoin, secp256k1, bip39, franc, compromise, pRetry, htmlToText,
//   marked, jsonDiff, cronParser
// Code Pro extras: z, zod, luxon, DateTime, jmespath, JSZip, pako, nodeCrypto, ms, ...
// Modes: $input.all() / items  |  each-item: $json / item / $input.item

const all = $input.all().map((i) => i.json);

return all.map((row, index) => ({
  json: {
    ...row,
    id: uuid.v4(),
    at: dayjs().toISOString(),
  },
  pairedItem: { item: index },
}));
```

---

## 5. Execution semantics

### 5.1 Modes

| Mode | Invocations | Primary context |
|---|---|---|
| All items | 1 | `items`, `$input.all()`, `$input.first()` |
| Each item | N | `item`, `$json`, `$binary`, `$itemIndex`, `$input.item` |

### 5.2 Async / timeout / console

- User code runs as async function body; await Promises.
- Default timeout 30s per invocation.
- `console.log` / `warn` / `error` → n8n logs/UI best-effort.

### 5.3 Return normalization

| User returns | Result |
|---|---|
| item-shaped `{ json }` / array of items | accept |
| plain object / array of plains | wrap `json` |
| `null`/`undefined` | empty (all-items) or skip (each-item) — document |
| primitive | **reject** with clear error |

Each-item: auto-set `pairedItem: { item: i }` if missing.

### 5.4 Errors

Use `NodeOperationError` for syntax, runtime, timeout, validation, missing library load.

---

## 6. Stock-compatible helpers

### 6.1 MVP (required Phase 2)

`$input.all`, `$input.first`, `$input.item`, `$json`, `$binary`, `$itemIndex`, `items`, `item`

### 6.2 Stretch

`$('NodeName')`, `$node`, `$now`/`$today`, Luxon globals, binary helpers via `this.helpers`, careful `$env` (default deny or allowlist)

---

## 7. Library injection engine

### 7.1 Rules

1. **`libraryRegistry`** is the only place that maps inject names → loaders.
2. Globals use **exact SuperCode names** where listed (portability).
3. Restricted `require(name)` only for registered package keys.
4. Heavy modules use **lazy getters** (load on first property access).
5. If load fails: getter throws `LibraryLoadError` with package name + install hint — do not crash node construction if possible.
6. `utils` is a **Code Pro helper bag** (clone SuperCode useful bits: sleep, pick, etc.) — implement intentionally, document methods.

### 7.2 Context merge order

```text
baseNatives (Buffer, URL, setTimeout, … carefully)
  + stockHelpers
  + libraryGlobals (registry)
  + user-safe console
```

Do **not** expose unrestricted `require`, `process` (or only minimal), `child_process`, `fs` by default.

---

## 8. SuperCode parity matrix (normative)

**Source comment (competitor):**

> SuperCode Node by Ken Kai - 55+ JavaScript Libraries Available  
> Available: _, lodash, axios, cheerio, dayjs, moment, dateFns, dateFnsTz, joi, Joi, validator, uuid, Ajv, yup, xml2js, XMLParser, YAML, papaparse, Papa, Handlebars, CryptoJS, forge, jwt, bcrypt, bcryptjs, XLSX, QRCode, fuzzy, stringSimilarity, slug, pluralize, qs, FormData, ini, toml, nanoid, bytes, phoneNumber, iban, web3, ytdl, ffmpeg, ffmpegStatic, utils, ccxt, coinGecko, solana, bitcoin, secp256k1, bip39, franc, compromise, pRetry, htmlToText, marked, jsonDiff, cronParser

### 8.1 Full inject table

| # | Inject symbol(s) | npm package | Load | Notes |
|---|---|---|---|---|
| 1 | `_`, `lodash` | `lodash` | eager | |
| 2 | `axios` | `axios` | lazy | HTTP |
| 3 | `cheerio` | `cheerio` | eager | |
| 4 | `dayjs` | `dayjs` | eager | plugins optional later |
| 5 | `moment` | `moment-timezone` | eager | SuperCode name is `moment` |
| 6 | `dateFns` | `date-fns` | eager | entire module export |
| 7 | `dateFnsTz` | `date-fns-tz` | eager | |
| 8 | `joi`, `Joi` | `joi` | eager | dual alias |
| 9 | `validator` | `validator` | eager | |
| 10 | `uuid` | `uuid` | eager | |
| 11 | `Ajv` | `ajv` | eager | constructor export pattern |
| 12 | `yup` | `yup` | lazy | |
| 13 | `xml2js` | `xml2js` | eager | |
| 14 | `XMLParser` | `fast-xml-parser` | eager | also consider exposing `XMLBuilder` |
| 15 | `YAML` | `yaml` | eager | |
| 16 | `papaparse`, `Papa` | `papaparse` | eager | dual alias |
| 17 | `Handlebars` | `handlebars` | eager | |
| 18 | `CryptoJS` | `crypto-js` | eager | |
| 19 | `forge` | `node-forge` | lazy | |
| 20 | `jwt` | `jsonwebtoken` | eager | |
| 21 | `bcrypt`, `bcryptjs` | `bcryptjs` | eager | pure JS |
| 22 | `XLSX` | `xlsx` | lazy | security advisories — document |
| 23 | `QRCode` | `qrcode` | lazy | |
| 24 | `fuzzy` | `fuse.js` | eager | SuperCode name `fuzzy` → Fuse |
| 25 | `stringSimilarity` | `string-similarity` | eager | |
| 26 | `slug` | `slug` | eager | handle default export |
| 27 | `pluralize` | `pluralize` | eager | |
| 28 | `qs` | `qs` | eager | |
| 29 | `FormData` | `form-data` | eager | |
| 30 | `ini` | `ini` | eager | |
| 31 | `toml` | `toml` | eager | |
| 32 | `nanoid` | `nanoid` | eager | ESM/CJS interop careful |
| 33 | `bytes` | `bytes` | eager | |
| 34 | `phoneNumber` | `libphonenumber-js` | eager | match SuperCode helper shape if known |
| 35 | `iban` | `iban` | eager | |
| 36 | `web3` | `web3` | lazy | heavy |
| 37 | `ytdl` | `@distube/ytdl-core` | lazy | ToS risk — document |
| 38 | `ffmpeg` | `fluent-ffmpeg` | lazy | needs binary |
| 39 | `ffmpegStatic` | `ffmpeg-static` | lazy | native path |
| 40 | `utils` | **first-party** | eager | sleep, retry helpers, etc. |
| 41 | `ccxt` | `ccxt` | lazy | heavy |
| 42 | `coinGecko` | `coingecko-api-v3` | lazy | |
| 43 | `solana` | `@solana/web3.js` | lazy | heavy |
| 44 | `bitcoin` | `bitcoinjs-lib` | lazy | |
| 45 | `secp256k1` | `@noble/secp256k1` | lazy | |
| 46 | `bip39` | `@scure/bip39` | lazy | |
| 47 | `franc` | `franc-min` | lazy | |
| 48 | `compromise` | `compromise` | lazy | |
| 49 | `pRetry` | `p-retry` | eager | ESM interop |
| 50 | `htmlToText` | `html-to-text` | eager | |
| 51 | `marked` | `marked` | eager | |
| 52 | `jsonDiff` | `json-diff-ts` | eager | |
| 53 | `cronParser` | `cron-parser` | eager | |

**Acceptance:** registry unit test iterates this table and asserts each inject key is defined on the sandbox object (lazy getters may be functions/getters that resolve).

### 8.2 SuperCode dependency pins (reference from 1.6.2)

Use as **starting pins** (may update for security):

`lodash`, `axios`, `cheerio`, `dayjs`, `moment-timezone`, `date-fns`, `date-fns-tz`, `joi`, `validator`, `uuid`, `ajv`, `yup`, `xml2js`, `fast-xml-parser`, `yaml`, `papaparse`, `handlebars`, `crypto-js`, `node-forge`, `jsonwebtoken`, `bcryptjs`, `xlsx`, `qrcode`, `fuse.js`, `string-similarity`, `slug`, `pluralize`, `qs`, `form-data`, `ini`, `toml`, `nanoid`, `bytes`, `libphonenumber-js`, `iban`, `web3`, `@distube/ytdl-core`, `fluent-ffmpeg`, `ffmpeg-static`, `ccxt`, `coingecko-api-v3`, `@solana/web3.js`, `bitcoinjs-lib`, `@noble/secp256k1`, `@scure/bip39`, `franc-min`, `compromise`, `p-retry`, `html-to-text`, `marked`, `json-diff-ts`, `cron-parser`, plus SuperCode’s `bufferutil` / `utf-8-validate` if required by websocket stacks.

Also in SuperCode package but not all in the one-line comment: `zod` (they ship it) — we expose as **`z` / `zod`** under extras (or parity if we list both).

---

## 9. Code Pro extras (beyond SuperCode comment list)

| Inject | Package | Purpose |
|---|---|---|
| `z`, `zod` | `zod` | Primary modern validation DX |
| `luxon`, `DateTime` | `luxon` | n8n-aligned dates |
| `jmespath` | `jmespath` | JSON query (Code node lacks expression `$jmespath`) |
| `JSZip` | `jszip` | ZIP archives |
| `pako` | `pako` | deflate/inflate |
| `nodeCrypto` | `crypto` (Node builtin) | native crypto |
| `ms` | `ms` | duration strings |
| `XMLBuilder` | `fast-xml-parser` | write XML (companion to `XMLParser`) |
| `ExcelJS` | `exceljs` | optional richer Excel (alongside `XLSX`) |

Extras may grow as owner needs; registry + docs must stay in sync.

**Minimum total inject count target:** SuperCode comment set (**~58 symbols counting aliases**) **+ extras (≥8)** → **market as 60+ / SuperCode-class**.

---

## 10. Security

### 10.1 Threat model

In-process user JS = **OS-level power of the n8n user**. Same class as installing SuperCode.

### 10.2 Hard rules

1. No `child_process` in sandbox.  
2. No unrestricted `require`.  
3. No multi-tenant “safe sandbox” marketing.  
4. README Security section mandatory before publish.  
5. Document ytdl/ffmpeg/blockchain operational and legal risks.  

### 10.3 Defaults

| Item | Default |
|---|---|
| Timeout | 30s |
| Output item cap | yes |
| axios / network libs | **available** (SuperCode parity) |
| `fs` | not injected |
| `process` | not injected (or minimal) |

---

## 11. Packaging & build

| Item | Spec |
|---|---|
| TS | commonjs, ES2022+, strict |
| outDir | `dist/` |
| n8n paths | compiled `.node.js` under dist |
| Bundle | optional webpack if resolution fails; SuperCode multi-v16/v18/v20 only if required |
| Size | expect large install (full parity); document Docker memory for `npm install` |

### 11.1 File layout

```text
nodes/CodePro/CodePro.node.ts
nodes/CodePro/codepro.svg
src/libraryRegistry.ts
src/sandboxContext.ts
src/executeUserCode.ts
src/resultValidation.ts
src/utilsBag.ts          # implements `utils` global
src/types.ts
```

---

## 12. Testing

| Suite | Requirement |
|---|---|
| Registry completeness | every §8.1 inject key registered |
| Result validation | wrap/reject cases |
| Execute timeout | infinite loop fails cleanly (best-effort) |
| Smoke (integration) | lodash, dayjs, zod, axios (optional network), papaparse, cheerio |
| Lazy heavies | accessing `ccxt` or `web3` either loads or clear error — does not break node list |

---

## 13. Compatibility

| Deployment | Support |
|---|---|
| Self-host + community packages | **Primary** |
| Queue workers | Package on **all** workers |
| n8n Cloud verified | **No** |
| Node.js | ≥ 20 |

---

## 14. Open decisions (narrowed) / closed by readiness research

| ID | Topic | Status |
|---|---|---|
| D1 | Package name | **Locked** `n8n-nodes-code-pro` |
| D2 | Library breadth | **Locked** SuperCode parity + extras |
| D3 | Network libs default | **Available** (parity) |
| D4 | Date primary | dayjs + moment + date-fns **and** luxon extra |
| D5 | Validation (schemas) | joi + yup + Ajv + validator **and** zod extra |
| D6 | Bundling | Phase 1: plain tsc. Phase 3: CJS pins for `nanoid`/`p-retry`; webpack or dynamic `import()` for remaining pure ESM |
| D7 | `utils` API | **Locked minimum:** `sleep`, `retry`, `flatten`, `getAvailableLibraries` (+ SuperCode-like extras optional) |
| D8 | Code param name | **`jsCode`** (stock), not SuperCode `code` |
| D9 | Editor | Prefer **`codeNodeEditor`** + `editorLanguage: 'javaScript'`; fallback **`jsEditor`** |
| D10 | Helpers source | **`this.getWorkflowDataProxy(itemIndex)`** + mode overlays |
| D11 | Result validation | **Stock rules** (`normalizeItems` + reserved keys); never SuperCode double-wrap |
| D12 | VM wrapper | Stock-style `async function VmCodeWrapper(){ userCode }()` |
| D13 | `FormData` global | **`form-data` package** (SuperCode parity) |
| D14 | `phoneNumber` | Entire **`libphonenumber-js`** module |

---

## 15. Phase 3 acceptance (library bar)

Code Pro library phase is done when:

1. Default template lists SuperCode-parity + extras.  
2. Unit test: all §8.1 symbols registered.  
3. Manual or automated smoke: `_`, `axios`, `cheerio`, `dayjs`, `zod`, `Papa`, `YAML`, `XLSX` (or clear load).  
4. Lazy access to `web3` / `ccxt` / `ffmpegStatic` does not prevent node from loading.  
5. README table: inject name | package | version | example one-liner.  
6. Owner extension checklist works for one new library end-to-end.

---

## 16. References

- Stock Code docs: https://docs.n8n.io/build/code-in-n8n/using-the-code-node/  
- Community risks: https://docs.n8n.io/integrations/community-nodes/risks/  
- SuperCode npm: https://www.npmjs.com/package/@kenkaiii/n8n-nodes-supercode  
- Stock Code source: https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Code/Code.node.ts  
- Starter: https://github.com/n8n-io/n8n-nodes-starter  

---

## 17. Document history

| Version | Date | Notes |
|---|---|---|
| 0.1 | 2026-07-16 | Pre-name draft under provisional folder |
| 0.2 | 2026-07-16 | Identity → Code Pro; SuperCode 55+ matrix normative; extras listed |
| 0.3 | 2026-07-16 | Implementation readiness: stock validation/proxy/VM, SuperCode sandbox details, ESM strategy, closed D8–D14 |
