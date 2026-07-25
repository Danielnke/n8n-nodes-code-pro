/**
 * @deprecated Prefer `import { … } from './execution'`
 * Compatibility re-export for scripts and older imports.
 */
export {
	type CodeProMode,
	type RunUserCodeOptions,
	buildSandbox,
	installLibraryGlobalsOnSandbox,
	createVmExecutableCode,
	runUserCode,
	enhanceExecutionError,
	isTimeoutError,
	getTimeoutErrorMeta,
	getExecutionAbortSignal,
	getExecutionContext,
	runWithExecutionContext,
	coerceTimeoutSec,
	normalizeTimeoutPolicy,
	MAX_SOFT_TIMEOUT_SEC,
	SYNC_VM_TIMEOUT_MS,
	buildInputHelpers,
	createConsole,
	createRestrictedRequire,
} from './execution';
