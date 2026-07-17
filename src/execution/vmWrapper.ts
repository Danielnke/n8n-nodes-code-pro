/**
 * Wrap user JS as an async function body for node:vm (stock-style).
 */

export function createVmExecutableCode(code: string): string {
	return [
		'globalThis.global = globalThis',
		'var module = { exports: {} }',
		`module.exports = async function CodeProVmWrapper() {${code}\n}()`,
	].join('; ');
}
