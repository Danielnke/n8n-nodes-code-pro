# Changelog

All notable changes to Code Pro are documented here.

## 0.6.1 - 2026-08-03

### Added

- Added a backward-compatible Language selector. Existing nodes without it continue to run JavaScript.
- Added native Python 3.11+ execution for both Code Pro modes, using one spawned process per node execution and a versioned JSON stdin/stdout protocol.
- Added Python authoring names (`_input`, `_json`, `_item`, `_item_index`, `items`, `item`), a Python editor/template, Python helper utilities, and JavaScript-compatible output normalization/linking behavior.
- Added deterministic interpreter discovery, optional per-node executable selection, bounded protocol/log/HTTP response handling, structured Python errors, and compiled-artifact Python regression tests.
- Added `examples/code-pro-python-basic.json` and package build inclusion for the maintained Python bootstrap asset.

### Security and operations

- Python is explicitly a trusted native child process, not a sandbox. It intentionally inherits the complete n8n environment and host permissions.
- Positive Python timeouts hard-terminate the process tree with bounded graceful and forced cleanup; JavaScript retains its existing cooperative timeout behavior.
- Documented Docker installation, queue-worker deployment, standard-library/third-party policy, external-runner guidance, and untrusted-code isolation requirements.

### Changed

- Bumped the package version to 0.6.1. The n8n node API version remains 1.
- First GitHub-tracked source release of the Python path (supersedes incomplete 0.6.0 npm snapshot alignment).

## 0.5.0 - 2026-08-02

### Security

- Updated or replaced vulnerable runtime dependencies; `npm audit --omit=dev` now reports zero known vulnerabilities.
- Removed the vulnerable `xlsx` package and its `XLSX` / `xlsx` globals. Use `ExcelJS`.
- Added bounded sitemap response, gzip, candidate, concurrency, depth, sitemap-count, and URL-count handling.
- Made output limits fail closed for invalid, zero, non-finite, and oversized settings.
- Added prominent in-node and README warnings that in-process VM execution is not a security boundary.

### Changed

- Requires Node.js 22.22.0 or newer, matching the current n8n community-node toolchain.
- Upgraded Jimp to 1.x and added compatibility for common Jimp 0.x calls.
- Removed the bundled `ffprobe-static` package to reduce install size; system `ffprobe` remains supported.
- Isolated mutable Axios, Lodash, Handlebars, and `utils` facades between executions.
- Added tracked execution timers and automatic cleanup.
- Added npm provenance publishing and continuous verification workflows.

### Fixed

- Each-item mode now treats `null`, `undefined`, and empty arrays as skipped output.
- Each-item output counting no longer creates an increasingly large temporary array.
- Invalid sitemap base URLs no longer trigger network requests.
- Sitemap discovery now rejects unrelated XML and canonicalizes HTTP(S) URLs.
- Nested sitemap expansion now supports relative locations without repeated queue shifting.

### Documentation

- Rebuilt the README around installation, value, recipes, operational limits, security, upgrades, troubleshooting, and shipped workflow examples.
- Documented sitemap limits, lazy-library behavior, the cooperative timeout boundary, and migration from removed globals.

## 0.4.3

- Previous public release.
