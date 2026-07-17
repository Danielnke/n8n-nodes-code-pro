/**
 * User-code execution engine (VM sandbox + run + errors).
 *
 * Layout:
 * - types.ts                      — CodeProMode, RunUserCodeOptions
 * - inputHelpers.ts               — $input.all / item overlays
 * - consoleBridge.ts              — console → n8n logger
 * - restrictedRequire.ts          — allowlisted require()
 * - installLibrariesOnSandbox.ts  — A-lite materialize onto sandbox
 * - buildSandbox.ts               — assemble context
 * - vmWrapper.ts                  — async function wrapper string
 * - enhanceErrors.ts              — Syntax/Reference/TypeError hints
 * - runUserCode.ts                — main entry
 */

export type { CodeProMode, RunUserCodeOptions } from './types';
export { buildInputHelpers } from './inputHelpers';
export { createConsole } from './consoleBridge';
export { createRestrictedRequire } from './restrictedRequire';
export { installLibraryGlobalsOnSandbox } from './installLibrariesOnSandbox';
export { buildSandbox } from './buildSandbox';
export { createVmExecutableCode } from './vmWrapper';
export { enhanceExecutionError } from './enhanceErrors';
export { runUserCode } from './runUserCode';
