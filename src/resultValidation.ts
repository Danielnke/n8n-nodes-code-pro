/**
 * @deprecated Prefer `import { … } from './validation'`
 * Compatibility re-export for scripts and older imports.
 */
export {
	REQUIRED_N8N_ITEM_KEYS,
	CodeProValidationError,
	normalizeItems,
	validateRunCodeEachItem,
	validateRunCodeAllItems,
	type NormalizeItemsFn,
} from './validation';
