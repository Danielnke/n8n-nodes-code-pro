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
	buildInputHelpers,
	createConsole,
	createRestrictedRequire,
} from './execution';
