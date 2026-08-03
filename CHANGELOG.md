# Changelog

All notable changes to Code Pro are documented here.

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
