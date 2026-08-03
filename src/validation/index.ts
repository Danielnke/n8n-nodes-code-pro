/**
 * Return-shape validation and output guards.
 */

export {
	REQUIRED_N8N_ITEM_KEYS,
	CodeProValidationError,
	normalizeItems,
	validateRunCodeEachItem,
	validateRunCodeAllItems,
	type NormalizeItemsFn,
} from './resultValidation';

export {
	CODE_PRO_MAX_OUTPUT,
	DEFAULT_MAX_OUTPUT_ITEMS,
	MAX_OUTPUT_ITEMS_LIMIT,
	coerceMaxOutputItems,
	isMaxOutputItemsError,
	enforceMaxOutputItemCount,
	enforceMaxOutputItems,
	maybeAddPairedItemHint,
} from './outputGuards';
