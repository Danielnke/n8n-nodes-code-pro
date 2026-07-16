# n8n-nodes-code-pro

**Code Pro** — self-hosted n8n community node for **JavaScript** with stock Code–compatible modes/helpers and a **large built-in library surface** (no `NODE_FUNCTION_ALLOW_EXTERNAL` / task-runner allowlists).

| | |
|---|---|
| Package | `n8n-nodes-code-pro` |
| Node | **Code Pro** (`codePro`) |
| Version | **0.2.1** |
| Language | JavaScript only |
| Inject globals | **68** names (aliases included) |
| npm packages | **~59** runtime libraries + first-party `utils` |

Globals are available **by name in your script** (e.g. `_.map(...)`, `dayjs()`, `z.object(...)`).  
Runtime inventory: `utils.getAvailableLibraries()`.

---

## Supported libraries

Inject name = global in the Code Pro sandbox. Aliases share the same package.

### Data manipulation & IDs

| Global(s) | npm package | What it’s for |
|---|---|---|
| `_`, `lodash` | `lodash` | Arrays/objects, grouping, deep get/set, chaining |
| `bytes` | `bytes` | Human-readable byte sizes ↔ numbers |
| `ms` | `ms` | Duration strings (`"5m"`) ↔ milliseconds |
| `qs` | `qs` | Query-string parse/stringify |
| `uuid` | `uuid` | UUID v1/v4/v5 (e.g. `uuid.v4()`) |
| `nanoid` | `nanoid` | Compact unique IDs (`nanoid.nanoid()`) |
| `utils` | *(built-in)* | `sleep`, `retry`, `flatten`, `getAvailableLibraries`, … |

### Dates & time

| Global(s) | npm package | What it’s for |
|---|---|---|
| `dayjs` | `dayjs` | Lightweight date parse/format/math |
| `moment` | `moment-timezone` | Dates with timezone support |
| `dateFns` | `date-fns` | Functional date helpers |
| `dateFnsTz` | `date-fns-tz` | Timezone-aware date-fns |
| `luxon`, `DateTime` | `luxon` | n8n-aligned DateTime API |
| `cronParser` | `cron-parser` | Cron expression next/prev runs |

### Validation & schemas

| Global(s) | npm package | What it’s for |
|---|---|---|
| `joi`, `Joi` | `joi` | Schema validation (object/string/number rules) |
| `yup` | `yup` | Schema validation (chainable) |
| `z`, `zod` | `zod` | TypeScript-first schema validation |
| `Ajv` | `ajv` | JSON Schema validation |
| `validator` | `validator` | String checks (email, URL, etc.) |
| `phoneNumber` | `libphonenumber-js` | Parse/validate/format phone numbers |
| `iban` | `iban` | IBAN validation |

### Parse / serialize (CSV, XML, YAML, config)

| Global(s) | npm package | What it’s for |
|---|---|---|
| `papaparse`, `Papa` | `papaparse` | CSV parse/unparse |
| `xml2js` | `xml2js` | XML ↔ JS objects |
| `XMLParser`, `XMLBuilder` | `fast-xml-parser` | Fast XML parse/build |
| `YAML` | `yaml` | YAML parse/stringify |
| `ini` | `ini` | INI config files |
| `toml` | `toml` | TOML config files |
| `jmespath` | `jmespath` | Query nested JSON (`a.b[0].c`) |
| `jsonDiff` | `json-diff-ts` | Structural JSON diffs |

### HTML, text, templates, fuzzy match

| Global(s) | npm package | What it’s for |
|---|---|---|
| `cheerio` | `cheerio` | jQuery-like HTML parsing/scraping |
| `htmlToText` | `html-to-text` | HTML → plain text |
| `marked` | `marked` | Markdown → HTML |
| `Handlebars` | `handlebars` | HTML/string templating |
| `slug` | `slug` | URL-safe slugs |
| `pluralize` | `pluralize` | English plural/singular |
| `fuzzy` | `fuse.js` | Fuzzy search over lists |
| `stringSimilarity` | `string-similarity` | Compare string similarity |
| `franc` | `franc-min` | Language detection |
| `compromise` | `compromise` | Lightweight NLP on text |

### Crypto, JWT, passwords

| Global(s) | npm package | What it’s for |
|---|---|---|
| `CryptoJS` | `crypto-js` | Hashing/encryption (MD5, AES, …) |
| `nodeCrypto` | `crypto` (Node) | Native Node crypto |
| `forge` | `node-forge` | TLS/PKI-oriented crypto primitives |
| `jwt` | `jsonwebtoken` | Sign/verify JWTs |
| `bcrypt`, `bcryptjs` | `bcryptjs` | Password hashing |
| `secp256k1` | `@noble/secp256k1` | secp256k1 keys/signatures |
| `bip39` | `@scure/bip39` | BIP-39 mnemonics |

### HTTP & networking

| Global(s) | npm package | What it’s for |
|---|---|---|
| `axios` | `axios` | HTTP client (GET/POST, JSON, …) |
| `FormData` | `form-data` | Multipart form bodies |
| `pRetry` | `p-retry` | Retry async operations |

### Spreadsheets, archives, QR

| Global(s) | npm package | What it’s for |
|---|---|---|
| `XLSX`, `xlsx` | `xlsx` | Read/write Excel workbooks (SheetJS community) |
| `ExcelJS` | `exceljs` | Richer Excel read/write |
| `JSZip` | `jszip` | Create/read ZIP archives |
| `pako` | `pako` | Deflate/inflate compression |
| `QRCode` | `qrcode` | Generate QR codes |

### Blockchain / trading / media (heavy; load when used)

| Global(s) | npm package | What it’s for |
|---|---|---|
| `web3` | `web3` | Ethereum / EVM interactions |
| `ccxt` | `ccxt` | Crypto exchange APIs |
| `coinGecko` | `coingecko-api-v3` | CoinGecko market data client |
| `solana` | `@solana/web3.js` | Solana web3 |
| `bitcoin` | `bitcoinjs-lib` | Bitcoin transactions/scripts |
| `ytdl` | `@distube/ytdl-core` | YouTube stream/info helpers |
| `ffmpeg` | `fluent-ffmpeg` | FFmpeg control API |
| `ffmpegStatic` | `ffmpeg-static` | Path to static ffmpeg binary |

---

### SuperCode-parity inject names (checklist)

These globals match the SuperCode-style surface (JavaScript focus):

`_`, `lodash`, `axios`, `cheerio`, `dayjs`, `moment`, `dateFns`, `dateFnsTz`, `joi`, `Joi`, `validator`, `uuid`, `Ajv`, `yup`, `xml2js`, `XMLParser`, `YAML`, `papaparse`, `Papa`, `Handlebars`, `CryptoJS`, `forge`, `jwt`, `bcrypt`, `bcryptjs`, `XLSX`, `QRCode`, `fuzzy`, `stringSimilarity`, `slug`, `pluralize`, `qs`, `FormData`, `ini`, `toml`, `nanoid`, `bytes`, `phoneNumber`, `iban`, `web3`, `ytdl`, `ffmpeg`, `ffmpegStatic`, `utils`, `ccxt`, `coinGecko`, `solana`, `bitcoin`, `secp256k1`, `bip39`, `franc`, `compromise`, `pRetry`, `htmlToText`, `marked`, `jsonDiff`, `cronParser`

### Code Pro extras (beyond that checklist)

`z`, `zod`, `luxon`, `DateTime`, `jmespath`, `JSZip`, `pako`, `nodeCrypto`, `ms`, `XMLBuilder`, `ExcelJS`, `xlsx` (alias of `XLSX`)

---

## Install (self-hosted)

### Community Nodes UI (after publish)

1. Settings → Community Nodes → Install  
2. Package: `n8n-nodes-code-pro`  
3. Restart n8n if needed  

### Local / custom extensions

```bash
cd n8n-nodes-code-pro
npm install
npm run build
```

```bash
# Windows PowerShell example
$env:N8N_CUSTOM_EXTENSIONS = "C:\path\to\n8n-nodes-code-pro"
```

Restart n8n. Palette: **Code Pro**.

---

## Usage (parameters)

| Parameter | Description |
|---|---|
| **Mode** | Run Once for All Items / Run Once for Each Item |
| **JavaScript** | Your script (`jsCode`); libraries are globals |
| **Options → Timeout** | Seconds (default 30) |
| **Options → Max Output Items** | Fail if more items returned (default 10 000) |

**Return shape:** all-items → `[{ json: { ... } }, ...]`; each-item → single `{ json: { ... } }`. Prefer `pairedItem` when counts differ.

Importable demos (optional): `examples/code-pro-basic.json`, `examples/code-pro-validate-zod.json`.

---

## Security

Code Pro runs **in the n8n process** (not the stock Code task-runner sandbox), with network-capable libraries available. Treat it as a **trusted power-user** node on **self-hosted** instances only.

---

## Develop

```bash
npm install
npm run build
npm run lint
npm run smoke:libs
npm run dev
```

---

## Docs

| File | Role |
|---|---|
| `AGENTS.md` | Contributor / agent rules |
| `PROJECT_PLAN.md` | Roadmap |
| `TECH_SPECS.md` | Technical design |

## License

MIT
