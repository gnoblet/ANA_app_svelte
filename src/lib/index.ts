// Public barrel — re-export shared types and utilities.
// Add new public APIs here as the library grows.

// Types
export type {
	IndicatorID,
	IndicatorType,
	Thresholds,
	Indicator,
	SubFactor,
	Factor,
	System,
	IndicatorsRoot,
	PreferenceEnum,
	AboveOrBelowEnum
} from './types/structure';
export { parseIndicatorType } from './types/structure';

// Colour helpers
export {
	dotFill,
	dotStroke,
	tileCssClass,
	SYSTEM_COLORS,
	systemFillColor,
	factorColor,
	subfactorColor,
	indicatorFillColor,
	formatIndicatorTooltip
} from './utils/colors';

// Number formatting
export { fmt, fmtPct } from './utils/format';

// General UI utility
export { cn } from './utils';
