# Project Plan: n8n-nodes-code-pro (Code Pro)

> **Status:** Phase 1 scaffold **implemented** (v0.1.0 executor) · 2026-07-16  
> **Package:** `n8n-nodes-code-pro`  
> **Node:** `codePro` / **Code Pro**  
> **Primary deliverable:** Self-hosted n8n community main-I/O node — stock Code UX parity + **≥ SuperCode’s 55+ JS library surface**, owner-controlled  
> **Siblings:** `../n8n-nodes-gplaces`, `../n8n-nodes-deepseek-ai-chat`  
This document is the **roadmap + research archive**. Coding rules: **`AGENTS.md`**. Normative design: **`TECH_SPECS.md`**. If this disagrees with later code, **code + README win**.

---

## 1. Current status summary

| Area | State |
|---|---|
| Research (stock Code, SuperCode, packaging) | Done |
| Architecture (in-process community + own deps) | Done |
| Package / node identity | **Locked** (`n8n-nodes-code-pro` / `codePro` / Code Pro) |
| npm name check | **Free** (404 as of 2026-07-16) |
| Library bar | **SuperCode parity (55+) + Code Pro extras** — not a minimal subset |
| Directory | `n8n-nodes-code-pro/` (renamed from provisional `n8n-nodes-js-code`) |
| Docs | AGENTS + PROJECT_PLAN + TECH_SPECS updated for identity + full lib list |
| Implementation | **Phase 1 done** (executor + validation; no library pack yet) |
| Version | **0.1.0** |
| Build | Green (`npm run build` / `lint`) |
| Implementation readiness research | Done (in TECH_SPECS / this plan) |

### Version history (docs)

| Version | Notes |
|---|---|
| 0.0.0-plan | Initial planning as provisional `n8n-nodes-js-code` |
| 0.0.1-plan | Identity → `n8n-nodes-code-pro`; SuperCode 55+ inject list mandatory |
| 0.0.2-plan | Implementation readiness: stock validation/proxy/VM, SuperCode sandbox reverse-eng, ESM strategy |

---

## 2. Why Code Pro exists

### 2.1 Stock Code limits (unchanged)

| Environment | Libraries | Pain |
|---|---|---|
| n8n Cloud JS | ~`crypto` + `moment` | No arbitrary npm |
| Self-host | Allowlist + install | Ops burden |
| n8n 2.x runners | Allowlist on **runner** image | Even harder |

Stock strengths to keep: modes, `$input`/`$json`, return shape, `console.log`, Promises.

### 2.2 SuperCode — library benchmark

**`@kenkaiii/n8n-nodes-supercode`** advertises 55+ JS libraries. Official template comment:

```text
// SuperCode Node by Ken Kai - 55+ JavaScript Libraries Available
// Available: _, lodash, axios, cheerio, dayjs, moment, dateFns, dateFnsTz,
// joi, Joi, validator, uuid, Ajv, yup, xml2js, XMLParser, YAML, papaparse, Papa,
// Handlebars, CryptoJS, forge, jwt, bcrypt, bcryptjs, XLSX, QRCode, fuzzy,
// stringSimilarity, slug, pluralize, qs, FormData, ini, toml, nanoid, bytes,
// phoneNumber, iban, web3, ytdl, ffmpeg, ffmpegStatic, utils, ccxt, coinGecko,
// solana, bitcoin, secp256k1, bip39, franc, compromise, pRetry, htmlToText,
// marked, jsonDiff, cronParser
```

| SuperCode trait | Our response |
|---|---|
| 55+ globals | **Must match inject names** so workflows/snippets port |
| JS + Python | We stay **JS only** |
| Huge webpack multi-target bundles | Prefer maintainable packaging; bundle only if needed |
| Kitchen-sink crypto/trading/media | **Include for parity** (user request); lazy-load heavies |
| Weaker stock helper docs | **Code Pro differentiates** on stock API fidelity + registry docs |

### 2.3 Goals

1. Package: `n8n-nodes-code-pro`, node **Code Pro** (`codePro`).
2. No host `NODE_FUNCTION_ALLOW_EXTERNAL` for our libraries.
3. Stock Code mode/helper/return parity (hard).
4. **Library surface ≥ SuperCode advertised set**, plus documented extras.
5. Adding a library = registry + `package.json` + docs + rebuild (owner control).

### 2.4 Non-goals

| Non-goal | Reason |
|---|---|
| Python | Product choice |
| Verified Cloud listing | Runtime deps |
| True multi-tenant sandbox | Separate product |
| Dropping SuperCode libs to “stay lean” | User explicitly wants full surface |

---

## 3. Product identity (locked)

| Field | Value |
|---|---|
| npm | `n8n-nodes-code-pro` |
| Node class | `CodePro` |
| Node `name` | `codePro` |
| Full type | `n8n-nodes-code-pro.codePro` |
| displayName | `Code Pro` |
| Credentials | none (MVP) |

### npm research (2026-07-16)

| Name | Status |
|---|---|
| `n8n-nodes-code-pro` | **Chosen** — free (404) |
| `n8n-nodes-js-code` | Abandoned provisional folder name |

Re-check before publish: `npm view n8n-nodes-code-pro`.

---

## 4. Library strategy (raised bar)

### 4.1 SuperCode parity inject names (mandatory)

Count of unique advertised symbols ≈ **58** (including aliases like `_`/`lodash`, `joi`/`Joi`, `papaparse`/`Papa`, `bcrypt`/`bcryptjs`).

| Inject name(s) | npm package (expected) | Category |
|---|---|---|
| `_`, `lodash` | `lodash` | Data |
| `axios` | `axios` | Network |
| `cheerio` | `cheerio` | HTML |
| `dayjs` | `dayjs` | Date |
| `moment` | `moment-timezone` | Date |
| `dateFns` | `date-fns` | Date |
| `dateFnsTz` | `date-fns-tz` | Date |
| `joi`, `Joi` | `joi` | Validation |
| `validator` | `validator` | Validation |
| `uuid` | `uuid` | IDs |
| `Ajv` | `ajv` | Validation |
| `yup` | `yup` | Validation |
| `xml2js` | `xml2js` | Parse |
| `XMLParser` | `fast-xml-parser` | Parse |
| `YAML` | `yaml` | Parse |
| `papaparse`, `Papa` | `papaparse` | CSV |
| `Handlebars` | `handlebars` | Template |
| `CryptoJS` | `crypto-js` | Crypto |
| `forge` | `node-forge` | Crypto |
| `jwt` | `jsonwebtoken` | Crypto |
| `bcrypt`, `bcryptjs` | `bcryptjs` | Crypto |
| `XLSX` | `xlsx` | Excel |
| `QRCode` | `qrcode` | Utility |
| `fuzzy` | `fuse.js` | Search |
| `stringSimilarity` | `string-similarity` | Search |
| `slug` | `slug` | String |
| `pluralize` | `pluralize` | String |
| `qs` | `qs` | Query |
| `FormData` | `form-data` | Network |
| `ini` | `ini` | Config |
| `toml` | `toml` | Config |
| `nanoid` | `nanoid` | IDs |
| `bytes` | `bytes` | Utility |
| `phoneNumber` | `libphonenumber-js` | Validation |
| `iban` | `iban` | Validation |
| `web3` | `web3` | Blockchain |
| `ytdl` | `@distube/ytdl-core` | Media |
| `ffmpeg` | `fluent-ffmpeg` | Media |
| `ffmpegStatic` | `ffmpeg-static` | Media |
| `utils` | custom helper object (SuperCode-style) | Utility |
| `ccxt` | `ccxt` | Trading |
| `coinGecko` | `coingecko-api-v3` | Trading |
| `solana` | `@solana/web3.js` | Blockchain |
| `bitcoin` | `bitcoinjs-lib` | Blockchain |
| `secp256k1` | `@noble/secp256k1` | Crypto |
| `bip39` | `@scure/bip39` | Crypto |
| `franc` | `franc-min` | NLP |
| `compromise` | `compromise` | NLP |
| `pRetry` | `p-retry` | Async |
| `htmlToText` | `html-to-text` | Text |
| `marked` | `marked` | Markdown |
| `jsonDiff` | `json-diff-ts` | Data |
| `cronParser` | `cron-parser` | Date |

Full inject matrix + load strategy: **`TECH_SPECS.md` §9**.

### 4.2 Code Pro extras (beyond SuperCode)

| Inject | Package | Why |
|---|---|---|
| `z`, `zod` | `zod` | Modern schema validation SuperCode’s template list omits as first-class (they may ship it; we guarantee `z`) |
| `luxon`, `DateTime` | `luxon` | Align with n8n’s date stack |
| `jmespath` | `jmespath` | Expression-style JSON queries missing from Code node helpers |
| `JSZip` | `jszip` | Archives |
| `pako` | `pako` | Compression |
| `nodeCrypto` | Node `crypto` | Prefer native crypto when in-process |
| `ms` | `ms` | Duration parsing (SuperCode may have elsewhere; we document) |
| `he` / `entities` | `entities` | HTML entities (optional) |
| `ExcelJS` | `exceljs` | Alternative Excel path with clearer write API (optional alias alongside `XLSX`) |

**Bar:** SuperCode parity **is floor**, not ceiling.

### 4.3 Heavy / fragile modules

These stay **in scope** for parity but must be **lazy-required** and documented:

- `ffmpeg-static`, `fluent-ffmpeg`
- `web3`, `@solana/web3.js`, `bitcoinjs-lib`, `ccxt`
- `@distube/ytdl-core`
- native peers (`bufferutil`, `utf-8-validate` if needed by web3 stack)

Install failures for optional natives should not break loading the node for non-media workflows if we use lazy getters (SuperCode pattern).

### 4.4 Owner extension workflow

1. `npm install <pkg>` into dependencies  
2. Register inject name(s) in `libraryRegistry.ts`  
3. README + TECH_SPECS table row  
4. Smoke test  
5. Rebuild + restart n8n  

---

## 5. Target architecture

```text
[ previous nodes ]
      │ main
      ▼
[ Code Pro  n8n-nodes-code-pro.codePro ]
  execute()
    ├─ mode, jsCode, timeout, options
    ├─ context = stock helpers + SuperCode-parity globals + extras
    ├─ run user JS (async, timeout, vm best-effort)
    ├─ normalize + validate → INodeExecutionData[]
    └─ return [ items ]
      │ main
      ▼
[ next nodes ]
```

Modules: `CodePro.node.ts`, `libraryRegistry.ts`, `sandboxContext.ts`, `executeUserCode.ts`, `resultValidation.ts`.

---

## 6. Competitive comparison (updated)

| Dimension | Stock Code | SuperCode | **Code Pro** |
|---|---|---|---|
| Package | built-in | `@kenkaiii/n8n-nodes-supercode` | **`n8n-nodes-code-pro`** |
| Language | JS + Python | JS + Python | **JS only** |
| JS lib count | ~0–2 on Cloud; allowlisted self-host | **55+ advertised** | **≥ SuperCode set + extras** |
| Inject names | `require` allowlist | globals | **Same SuperCode names + extras** |
| Stock helper parity | Native | Partial | **Hard goal** |
| Owner controls libs | Instance admin | SuperCode author | **This repo** |
| Isolation | Task runners | In-process | In-process + timeouts |

---

## 7. Phase checklist

### Phase 0 — Planning

- [x] Research stock Code + SuperCode + packaging  
- [x] Architecture decision  
- [x] Docs created  
- [x] **Identity locked:** `n8n-nodes-code-pro` / Code Pro / `codePro`  
- [x] **Library bar:** SuperCode 55+ inject list mandatory + extras  
- [x] npm name availability check  
- [x] Implementation readiness pass (stock source, SuperCode bytecode, ESM, types)  

### Phase 1 — Scaffold + minimal executor

- [x] 1.1 `package.json` name `n8n-nodes-code-pro`, `n8n.nodes` → dist  
- [x] 1.2 `tsconfig`, `.gitignore`  
- [x] 1.3 `CodePro.node.ts` — displayName Code Pro, modes, `codeNodeEditor`  
- [x] 1.4 `jsCode` param + timeout param  
- [x] 1.5 Stock-style VM async wrapper + result validation (not SuperCode double-wrap)  
- [x] 1.6 Icon + build (green)  
- [ ] 1.7 Load into local n8n (user verify)  
- [x] 1.8 README install  
- [x] Git init (`main`)  


### Phase 2 — Stock Code compatibility

- [ ] Helpers MVP + pairedItem + console + async  
- [ ] Fixture tests for return shapes  

### Phase 3 — Full library registry (SuperCode parity + extras)

- [ ] 3.1 `libraryRegistry` with **every** SuperCode inject name  
- [ ] 3.2 `package.json` dependencies for full set  
- [ ] 3.3 Lazy load for heavy modules  
- [ ] 3.4 Code Pro extras (`zod`, `luxon`, `jmespath`, zip/compression, …)  
- [ ] 3.5 Restricted `require` map  
- [ ] 3.6 Document all symbols + versions  
- [ ] 3.7 Smoke tests: one call per inject family  

### Phase 4 — Safety & UX

- [ ] Timeout, output caps  
- [ ] Security README (in-process risk)  
- [ ] Default code template listing available globals (SuperCode-style comment block + our extras)  

### Phase 5 — Packaging hardening

- [ ] Evaluate webpack bundle vs node_modules resolution  
- [ ] Optional multi-Node target only if required  
- [ ] Size/install troubleshooting for ffmpeg/native  

### Phase 6 — Release

- [ ] Example workflows  
- [ ] SuperCode → Code Pro migration notes (same globals)  
- [ ] Stock Code → Code Pro notes  
- [ ] 0.1.0 + optional npm publish (user approval)  
- [ ] Optional AI Tool node (only if requested)  

---

## 8. Risks & decisions log

| ID | Topic | Resolution |
|---|---|---|
| R1 | Isolation vs stock | Accept; document |
| R2 | No verified Cloud | Accept |
| R3 | Full SuperCode lib set = large install | Accept per user; lazy-load heavies |
| R4 | ffmpeg/native install failures | Lazy require; clear errors; README |
| R5 | xlsx advisories | Ship for parity; document; optional ExcelJS extra |
| R6 | `vm` not a sandbox | Honest docs |
| R7 | Package name | **Locked** `n8n-nodes-code-pro` |
| R8 | Legal/ToS (ytdl, etc.) | User responsibility; document |
| R9 | Workers must install package | Document queue-mode |

---

## 9. Success metrics

### Library bar

- [ ] Every SuperCode advertised inject name present in registry  
- [ ] At least one smoke path per major category (data, network, crypto, excel, blockchain lazy, media lazy)  
- [ ] Extras (`zod`, `luxon`, `jmespath`, zip) documented  

### Product bar

- [ ] Stock modes + helpers MVP  
- [ ] Self-host install without runner allowlists  
- [ ] Owner can add a library in one PR checklist  

---

## 10. Document control

| Doc | Role |
|---|---|
| `README.md` | Install, usage, full library table (Phase 1+) |
| `AGENTS.md` | Contributor/agent rules |
| `TECH_SPECS.md` | Normative design + inject matrix |
| `PROJECT_PLAN.md` | This file |

---

## 11. Immediate next step

**Phase 1 scaffold** is unblocked:

1. Create `package.json` / TypeScript / `CodePro.node.ts`  
2. Minimal executor  
3. Then Phase 3 library wiring (can start registry early in parallel)

Say when to start implementation.
