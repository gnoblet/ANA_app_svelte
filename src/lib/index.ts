// Public barrel — re-export shared types and utilities.
// Add new public APIs here as the library grows.

// Types
export type {
	MetricID,
	MetricType as IndicatorType,
	Thresholds,
	Metric,
	Indicator,
	SubFactor,
	Factor,
	System,
	ReferenceRoot as IndicatorsRoot
} from '$lib/types/structure';
export { MetricPreferenceEnum, MetricDirectionEnum, parseMetricType as parseIndicatorType } from '$lib/types/structure';

// Colour helpers
export {
	dotFill,
	dotStroke,
	tileCssClass,
	systemFillColor,
	factorColor,
	subfactorColor,
	indicatorFillColor,
	metricFillColor,
	formatMetricTooltip
} from './utils/colors';

// Number formatting
export { fmt, fmtPct } from './utils/format';

// General UI utility
export { cn } from './utils';
