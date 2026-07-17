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
	isMaxOutputItemsError,
	enforceMaxOutputItems,
	maybeAddPairedItemHint,
} from './outputGuards';
