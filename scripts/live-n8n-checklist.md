# Live n8n checklist — Code Pro

> **Acceptance gate.** Local `npm run smoke:libs` / `test:libs` / `verify:n8n-sim` / `test:golden` are **regression only**.  
> Product is not “fixed” until this checklist is filled for your instance.  
> Related: `FAILURE_ANALYSIS.md` (L0–L6), package version in root `package.json`.

---

## 0. Rebuild & load discipline (mandatory)

```bash
cd n8n-nodes-code-pro
npm install
npm run build
```

Then either:

| Mechanism | Action |
|---|---|
| **Custom extensions** | Set `N8N_CUSTOM_EXTENSIONS` to the **package root** (folder containing `package.json` + `dist/` + `node_modules/`). Restart n8n. |
| **Community nodes** | Install/reinstall package into `~/.n8n/nodes` (or Docker equivalent). Ensure install finished without OOM. Restart n8n. |

**Queue mode:** install the same package on **every worker**.

After any code change: **build → restart n8n → re-run probe 1** (version must match `package.json`).

---

## 1. Environment discovery

| Check | Result (fill in) |
|---|---|
| n8n version | |
| OS / Docker / bare | |
| Load mechanism (`N8N_CUSTOM_EXTENSIONS` / community) | |
| Absolute path to loaded package root | |
| `dist/nodes/CodePro/CodePro.node.js` exists | Y / N |
| `node_modules/axios` resolvable under that tree | Y / N |
| n8n restarted after last build | Y / N |
| Workers (if any) have same package | Y / N / N/A |

---

## 2. Failure classification (L0–L6)

Mark all that apply after probes below:

| Bucket | Applies? | Notes |
|---|---|---|
| **L0** Node missing from palette | | |
| **L1** Wrong/stale build (version mismatch) | | |
| **L2** Basic return fails | | |
| **L3** Library missing / not defined | | |
| **L4** Mode / multi-return validation | | |
| **L5** Soft timeout | | |
| **L6** Engine OK, business outcome empty (e.g. `found: false`) | | |

---

## 3. Probes (copy-paste into Code Pro)

Use **Run Once for All Items** unless noted. Timeout ≥ 60s for HTTP probes.

### Probe 1 — identity (L0/L1)

```javascript
return [{
  json: {
    ok: true,
    version: utils.getCodeProVersion(),
    libs: utils.getRegisteredLibraries().length,
  },
}];
```

| Expect | Pass? |
|---|---|
| Node runs without engine error | |
| `version` equals root `package.json` version | |

### Probe 2 — core libs (L3)

```javascript
return [{
  json: {
    n: _.add(1, 2),
    id: uuid.v4(),
    d: dayjs().year(),
  },
}];
```

| Expect | Pass? |
|---|---|
| `n === 3`, uuid string, year number | |

### Probe 3 — axios (L3 / network)

```javascript
const r = await axios.get('https://example.com', {
  timeout: 8000,
  responseType: 'text',
});
return [{ json: { status: r.status, len: String(r.data).length } }];
```

| Expect | Pass? |
|---|---|
| No `ReferenceError: axios is not defined` | |
| `status` 200 **or** clear network error (not silent) | |

### Probe 4 — sitemap script engine OK (L2/L5/L6)

Paste full “Fetch Sitemap XML” script. Mode: **All Items**. Input: `{ "website": "example.com" }`.

| Expect | Pass? |
|---|---|
| **No engine error** (validation/timeout/syntax) | |
| Record `found` true/false separately (false is **not** automatic fail) | `found=` |

### Probe 5 — each-item multi-return (L4)

Mode: **Run Once for Each Item**. Two input items. Code:

```javascript
const all = $input.all();
return all.map((i) => ({ website: i.json.website, n: all.length }));
```

| Expect | Pass? |
|---|---|
| Clear error: return single object / switch to All Items | |
| Message mentions multi-item batch / switch to All Items | |

---

## 4. Editor UX (font)

| Check | Pass? |
|---|---|
| Code editor uses `jsEditor` | |
| Monospaced editor size acceptable in NDV | |

If still small: browser zoom; no community-node CSS font API.

---

## 5. Sign-off

| Item | Value |
|---|---|
| Date | |
| Operator | |
| Open buckets deferred (with reason) | |
| Production-ready claim allowed? | **Only if L0–L4 closed** (L5/L6 documented) |
