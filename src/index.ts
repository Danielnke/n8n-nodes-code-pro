/**
 * Code Pro internal API surface.
 *
 * Prefer importing from domain barrels:
 * - `./execution`  — VM run / sandbox
 * - `./libraries`  — inject registry
 * - `./validation` — return shapes + caps
 * - `./utils`      — utils global + version
 *
 * Root shims (`executeUserCode.ts`, `libraryRegistry.ts`, …) re-export for
 * older scripts that require `dist/src/<name>.js`.
 */

export * from './execution';
export * from './libraries';
export * from './validation';
export * from './utils';
