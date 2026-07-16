# AGENTS.md — Code Pro (`n8n-nodes-code-pro`)

Operating manual for humans and coding agents working in this repository.

**Read this file, `TECH_SPECS.md`, and `PROJECT_PLAN.md` before changing code.**  
Prefer a future `README.md` for user-facing install/usage once Phase 1 ships.

---

## 1. Mission

Build a **self-hosted n8n community node** that is a **strict upgrade** over the built-in Code node for **JavaScript only**, and **library-competitive with SuperCode (55+ globals)** while remaining **owner-controlled**:

| Goal | Detail |
|---|---|
| Parity (stock Code) | Modes, `$input` / `$json` / items, return shape, paired items |
| Parity (SuperCode libs) | Support **the same inject surface SuperCode advertises** (≥55 JS libraries) — see §5.4 / `TECH_SPECS.md` |
| Superiority | Stock helper fidelity, leaner packaging options, documented registry, owner can add libs anytime, extras SuperCode lacks (e.g. `zod`, `luxon`, `jmespath`, compression) |
| Control | Libraries live in **this package**; no `NODE_FUNCTION_ALLOW_EXTERNAL` / runner image hacks |
| Scope | **JavaScript only** — no Python |

### Product one-liner

> **Code Pro** — n8n main-I/O node that runs user JavaScript with stock Code compatibility **plus** 55+ automation libraries (SuperCode-class surface), owned and extensible in this repo.

### Do not

- Implement Python
- Claim parity with stock Code’s **security sandbox**
- Target n8n Cloud **verified** packaging while runtime library dependencies remain
- Drop SuperCode-parity libraries without an explicit user decision (user wants **more**, not a thin subset)
- Hijack stock type names (`code` / displayName exactly `Code` alone is OK only if clearly branded **Code Pro**)
- Commit secrets, force-push, or `npm publish` without explicit user request
- Leave production `console.log` noise in **node implementation** (user code may use `console.log`)

---

## 2. Source of truth (priority)

| Priority | Source |
|---|---|
| 1 | User instructions in the current chat |
| 2 | **This repo’s code** (once it exists: `nodes/`, `package.json`) |
| 3 | `README.md` (user-facing — create when shipping) |
| 4 | `AGENTS.md` (this file) |
| 5 | `TECH_SPECS.md` (normative design + full library matrix) |
| 6 | `PROJECT_PLAN.md` (roadmap, research) |
| 7 | Official n8n docs + stock Code source |
| 8 | SuperCode (`@kenkaiii/n8n-nodes-supercode`) — **capability benchmark for library list** |

If docs conflict with code, **update the docs** (or fix code if wrong).

**Note:** Earlier “Supabase community node with 50+ libraries” refers to **SuperCode**.

---

## 3. Current project state

| Item | Status |
|---|---|
| Directory | **`n8n-nodes-code-pro/`** |
| npm package name | **Locked:** `n8n-nodes-code-pro` (404 / free on npm as of 2026-07-16) |
| Node identity | **Locked** — see §4 |
| AGENTS / PROJECT_PLAN / TECH_SPECS | Active; library target SuperCode 55+ |
| TypeScript scaffold | **Done** |
| Execution engine | **Done** (vm + stock-like validation) |
| Library registry | **Done** (v0.2.0 — SuperCode-parity + extras; smoke 68 injects / 0 fail) |
| Git | Initialized on `main` |
| README / icon | Done |
| npm publish | Not done |

---

## 4. Locked identity

| Concept | Value |
|---|---|
| Directory / npm package | `n8n-nodes-code-pro` |
| Keyword | must include `n8n-community-node-package` |
| Node class / file | `CodePro` → `nodes/CodePro/CodePro.node.ts` |
| Node `name` | `codePro` |
| Full type | `n8n-nodes-code-pro.codePro` |
| displayName | `Code Pro` |
| Defaults name | `Code Pro` |
| Credentials | **None** (MVP) |
| Connection | `main` → `main` via `execute()` |
| Group | `transform` |
| Icon | `nodes/CodePro/codepro.svg` or `.png` → `file:codepro.svg` |

Do **not** use: `n8n-nodes-js-code` (old provisional folder name), SuperCode type names, stock `code` as internal `name`.

Before first publish: re-check `npm view n8n-nodes-code-pro` still 404 (or you own it).

---

## 5. Architecture rules (must keep)

### 5.1 Node type

```ts
inputs: [NodeConnectionTypes.Main]  // or ['main']
outputs: [NodeConnectionTypes.Main]
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  // evaluate user JS; return [items]
}
```

Not a Chat Model / AI sub-node. Optional **Tool** variant = later phase only.

### 5.2 Why libraries work without host allowlists

Community nodes run in the **n8n process**. `require()` resolves from **this package’s** dependency tree. Stock Code’s `NODE_FUNCTION_ALLOW_EXTERNAL` / task-runner allowlists do **not** apply.

Tradeoff: weaker isolation than stock Code. Document as trusted power-user self-host node.

### 5.3 Stock Code compatibility contract

Must support:

1. Modes: **Run Once for All Items** / **Run Once for Each Item**
2. Helpers: `$input`, `$json`, `$binary`, `$itemIndex`, `items` / `item` (MVP); expand in Phase 2
3. Return normalization + validation
4. `console.log` to n8n UI when feasible
5. Async / Promises
6. Clear errors on bad return shapes
7. `pairedItem` on each-item path

### 5.4 Library surface — SuperCode parity is mandatory

**Target inject list (SuperCode advertised set — must support):**

```text
_, lodash, axios, cheerio, dayjs, moment, dateFns, dateFnsTz,
joi, Joi, validator, uuid, Ajv, yup, xml2js, XMLParser, YAML,
papaparse, Papa, Handlebars, CryptoJS, forge, jwt, bcrypt, bcryptjs,
XLSX, QRCode, fuzzy, stringSimilarity, slug, pluralize, qs, FormData,
ini, toml, nanoid, bytes, phoneNumber, iban, web3, ytdl, ffmpeg,
ffmpegStatic, utils, ccxt, coinGecko, solana, bitcoin, secp256k1,
bip39, franc, compromise, pRetry, htmlToText, marked, jsonDiff, cronParser
```

**Plus Code Pro extras** (differentiation — see `TECH_SPECS.md`): e.g. `z`/`zod`, `luxon`/`DateTime`, `jmespath`, `JSZip`/`pako`, `nodeCrypto`, optional `ExcelJS`, etc.

Rules:

- Single **`libraryRegistry.ts`** is source of truth (inject name → package → tier).
- Inject as **globals** matching SuperCode names so SuperCode snippets mostly work.
- Also offer a **restricted `require('lodash')` map** for stock-style code.
- Prefer lazy `require` for heavy modules (`web3`, `ccxt`, `ffmpeg-static`, …).
- **Do not** silently omit a SuperCode-parity symbol; if a dep is optional/unavailable, document and throw a clear “not installed / failed to load” error.

### 5.5 Tiers (packaging, not a reason to ship fewer libs)

| Tier | Contents |
|---|---|
| **Full (default)** | SuperCode-parity set + Code Pro extras — user expectation is “batteries included” |
| Optional future | Split packs only if install size forces it; default remains full |

Default product stance after user direction: **support more / full SuperCode surface**, not a minimal Core-only MVP for libraries.

### 5.6 Security defaults

| Capability | Default | Rationale |
|---|---|---|
| Network (`axios`, etc.) | Available (SuperCode parity) but README must warn | SuperCode ships axios freely; document risk |
| Filesystem | Not injected as `fs` by default | Avoid silent secret reads |
| `child_process` | **Never** | Hard no |
| Timeout | **On** (default 30s, configurable) | Hang protection |
| Output caps | **On** | Memory protection |
| `vm` | Best-effort only | Not a real multi-tenant sandbox |

### 5.7 Packaging

- Follow `../n8n-nodes-deepseek-ai-chat` and `../n8n-nodes-gplaces`.
- `package.json` → `n8n.n8nNodesApiVersion: 1`, `n8n.nodes` → **dist** paths.
- `peerDependencies`: `n8n-workflow: *`
- All SuperCode-parity libs in `dependencies` (or webpack-bundled equivalent).
- Build: `tsc` (+ optional webpack) + copy icon.
- Do **not** commit `node_modules/` or secrets.

---

## 6. File map

```text
n8n-nodes-code-pro/
  AGENTS.md
  PROJECT_PLAN.md
  TECH_SPECS.md
  README.md
  package.json
  tsconfig.json
  scripts/smoke-libs.js
  nodes/CodePro/
    CodePro.node.ts
    codepro.svg
  src/
    executeUserCode.ts
    libraryRegistry.ts      # SuperCode parity + extras
    resultValidation.ts
    utilsBag.ts
  dist/                     # gitignored
```

---

## 7. Commands

```bash
npm install
npm run build
npm run lint
npm run dev
npm run smoke:libs   # require all packages + load registry
```

Windows PowerShell: prefer `;` over `&&` when chaining is fragile.

After code changes: **build → sync into n8n → restart n8n**.

---

## 8. Dependencies policy

| Package | Role |
|---|---|
| `n8n-workflow` | peer (+ dev for types) |
| SuperCode-parity set | runtime `dependencies` — full list in `TECH_SPECS.md` |
| Code Pro extras | runtime `dependencies` |
| Bundler | optional webpack/esbuild if resolution requires it |
| Private `@n8n/*` | never required runtime deps |

Native / heavy modules (`ffmpeg-static`, `bufferutil`, etc.) may need install caveats in README; still in scope for SuperCode parity.

---

## 9. Testing checklist (Phase 1+)

- [ ] Build + lint clean
- [ ] Node appears as **Code Pro**
- [ ] All-items / each-item + `pairedItem`
- [ ] Stock helpers MVP work
- [ ] **Every SuperCode-parity inject name** resolves (or clear load error)
- [ ] Spot-check: lodash, axios, cheerio, zod (extra), XLSX, jwt, dayjs
- [ ] Bad return shape → clear error
- [ ] Timeout aborts runaway loops
- [ ] No secrets in commits

---

## 10. Git & releases

- Initialize git when scaffolding code (or when user asks)
- Ignore: `node_modules/`, `dist/`, `.env*`, logs, IDE junk, pack tarballs
- Semver in `package.json`; bump with meaningful changes
- Do not publish without user approval

```text
feat: ...
fix: ...
docs: ...
chore: ...
```

---

## 11. Sibling projects

| Package | Copy |
|---|---|
| `../n8n-nodes-gplaces` | `execute()` packaging, item loop |
| `../n8n-nodes-deepseek-ai-chat` | Doc discipline only — not `supplyData` / LangChain |

---

## 12. External links

- Stock Code: https://docs.n8n.io/build/code-in-n8n/using-the-code-node/
- Built-ins: https://docs.n8n.io/build/code-in-n8n/use-built-in-shortcuts/
- Data structure: https://docs.n8n.io/build/work-with-data/understand-n8ns-data-structure/
- Enable modules: https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/configuration-examples/enable-modules-in-code-node/
- Task runners: https://docs.n8n.io/deploy/host-n8n/configure-n8n/set-up-task-runners/
- Community nodes: https://docs.n8n.io/connect/create-nodes/overview/
- Risks: https://docs.n8n.io/integrations/community-nodes/risks/
- Starter: https://github.com/n8n-io/n8n-nodes-starter
- SuperCode: https://www.npmjs.com/package/@kenkaiii/n8n-nodes-supercode
- Stock Code source: https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/Code/Code.node.ts
