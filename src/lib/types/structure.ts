/**
 * src/lib/types/structure.ts
 *
 * Canonical data-shape types for indicators.json.
 * No Zod, no validation logic — pure types, enums, and type-parsing utilities.
 *
 * Imported by:
 *   - src/lib/types/indicators.ts  (Zod schemas + validation helpers)
 *   - scripts/generate-indicators-json.ts  (CSV → JSON generation)
 */

// ── Primitive type aliases ────────────────────────────────────────────────────

export type IndicatorID = string;

/** A valid type string (e.g. 'num[0:1]', 'int[0+]') or null when unset. */
export type IndicatorType = string | null;

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum PreferenceEnum {
	One = 1,
	Two = 2,
	Three = 3
}

export enum AboveOrBelowEnum {
	Above = 'Above',
	Below = 'Below'
}

// ── Type-string parsing ───────────────────────────────────────────────────────

/**
 * Regex matching valid indicator type strings.
 *
 *   base ( '[' bound ( ':' bound | '+' ) ']' )?
 *   base  = 'num' | 'int'
 *   bound = integer or decimal number
 *
 * Examples: num  num[0+]  num[0:1]  num[0:24]  int[0+]  int[0:1]  int[1:5]
 */
/** Regex matching valid indicator ID strings: IND001 .. IND200 */
export const INDICATOR_ID_REGEX = /^IND(?:00[1-9]|0[1-9][0-9]|1[0-9]{2}|200)$/;

export const INDICATOR_TYPE_REGEX =
	/^(?:num|int)(?:\[(\d+(?:\.\d+)?)(?::(\d+(?:\.\d+)?)|(\+))\])?$/;

export interface ParsedIndicatorType {
	base: 'num' | 'int';
	/** Lower bound (inclusive), or null if no range specified. */
	lb: number | null;
	/** Upper bound (inclusive), or null if half-open or no range. */
	ub: number | null;
	/** True when the range uses the `lb+` (half-open) syntax. */
	isOpen: boolean;
}

/** Parse a type string into its components. Returns null if the format is unrecognised. */
export function parseIndicatorType(type: string): ParsedIndicatorType | null {
	const m = type.match(/^(num|int)(?:\[(\d+(?:\.\d+)?)(?::(\d+(?:\.\d+)?)|(\+))\])?$/);
	if (!m) return null;
	return {
		base: m[1] as 'num' | 'int',
		lb: m[2] != null ? Number(m[2]) : null,
		ub: m[3] != null ? Number(m[3]) : null,
		isOpen: m[4] === '+'
	};
}

// ── Data interfaces ───────────────────────────────────────────────────────────

export interface Thresholds {
	an: number | null;
	an_label?: string | null;
	van?: number | null;
	van_label?: string | null;
}

export interface Indicator {
	indicator: IndicatorID;
	level?: string | null;
	indicator_label?: string | null;
	preference: number;
	type: IndicatorType;
	metric?: string | null;
	msna_module?: string | null;
	msna_indicator?: string | null;
	question_kobo_code?: string | null;
	remarks_limitations?: string | null;
	thresholds: Thresholds;
	above_or_below: string;
	evidence_threshold?: number | null;
	factor_threshold: number;
	risk_concept?: string | null;
}

export interface SubFactor {
	id: string;
	label?: string | null;
	indicators: Indicator[];
}

export interface Factor {
	id: string;
	label?: string | null;
	sub_factors: SubFactor[];
}

export interface System {
	id: string;
	label?: string | null;
	factors: Factor[];
}

export interface IndicatorsRoot {
	systems: System[];
}
