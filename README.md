# n8n-nodes-code-pro

**Code Pro** — a self-hosted n8n community node for running **JavaScript** with stock Code–compatible modes and helpers.

> **v0.1.0 (Phase 1):** Executor + validation + stock-like `$input` / modes.  
> **SuperCode-class library catalog (55+ globals)** ships in a follow-up release — see `TECH_SPECS.md`.

## Install (self-hosted)

### Option A — Community Nodes UI

1. Settings → Community Nodes → Install  
2. Package: `n8n-nodes-code-pro` (after publish)  
3. Restart n8n if needed  

### Option B — Local / custom extensions (development)

```bash
cd n8n-nodes-code-pro
npm install
npm run build
```

Point n8n at this package root (directory that contains `package.json` + `dist/`):

```bash
# example
set N8N_CUSTOM_EXTENSIONS=C:\path\to\n8n-nodes-code-pro
```

Restart n8n. Search the palette for **Code Pro**.

## Usage

| Parameter | Description |
|---|---|
| **Mode** | Run Once for All Items / Run Once for Each Item (same as stock Code) |
| **JavaScript** | Your script (`jsCode`) |
| **Timeout** | Seconds (default 30) |

### All items

```js
const items = $input.all();
return items.map((item, i) => ({
  json: { ...item.json, ok: true },
  pairedItem: { item: i },
}));
```

### Each item

```js
return {
  json: {
    ...$json,
    upper: String($json.name ?? '').toUpperCase(),
  },
};
```

## Security

Code Pro runs **in the n8n process** (not the isolated task-runner sandbox). Anyone who can edit workflows can run arbitrary JS as the n8n OS user. Use only on **trusted self-hosted** instances.

## Develop

```bash
npm install
npm run build
npm run lint
npm run dev   # tsc --watch
```

## Docs

- `AGENTS.md` — contributor / agent rules  
- `PROJECT_PLAN.md` — roadmap  
- `TECH_SPECS.md` — design + library matrix  

## License

MIT
