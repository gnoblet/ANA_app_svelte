import { z } from 'zod';
import { SystemIDEnum } from './generated/system-enum';
import {
	type Thresholds,
	type Indicator,
	type SubFactor,
	type Factor,
	type System,
	type IndicatorsRoot,
	PreferenceEnum,
	AboveOrBelowEnum,
	INDICATOR_TYPE_REGEX,
	INDICATOR_ID_REGEX,
	parseIndicatorType
} from './structure';
export type { Thresholds, Indicator, SubFactor, Factor, System, IndicatorsRoot };
export {
	PreferenceEnum,
	AboveOrBelowEnum,
	INDICATOR_TYPE_REGEX,
	INDICATOR_ID_REGEX,
	parseIndicatorType
};
export type { ParsedIndicatorType } from './structure';
export type { IndicatorID, IndicatorType } from './structure';

/**
 * TypeScript types (exports) and Zod runtime schemas for the nested indicators JSON.
 *
 * - Use `validateIndicatorsRoot` to parse & validate (throws on invalid).
 * - Use `safeValidateIndicatorsRoot` to get a non-throwing result.
 *
 * ─── Type column syntax ───────────────────────────────────────────────────────
 *
 *   type  = base ( '[' range ']' )?
 *   base  = 'num' | 'int'
 *   range = bound ':' bound   (closed interval [lb, ub])
 *         | bound '+'          (half-open: value >= lb)
 *   bound = number             (integer or decimal)
 *
 *   Examples: num  num[0+]  num[0:1]  num[0:24]  int[0+]  int[0:1]  int[1:5]
 *
 *   null  → indicator has no type constraint (empty Type in source CSV).
 *           Structural validation still passes.
 *
 * ─── What this schema validates (structural only) ────────────────────────────
 *
 *   The Zod schema here is concerned with JSON structure only:
 *   - Field types and nullability.
 *   - `type` must match the syntax regex (or be null).
 *   - `van` cannot be non-null when `an` is null (structural dependency).
 *
 *   Type-bound checks — i.e. whether a user-supplied CSV cell value satisfies
 *   the constraints implied by the `type` string (int vs num, lb, ub) — are
 *   performed at the CSV validation stage in:
 *     src/lib/processing/validator.js → checkValueAgainstType()
 *   They are intentionally NOT enforced here.
 *
 * ─── Threshold fields ────────────────────────────────────────────────────────
 *
 *   - thresholds.an       : number | null  (acute needs threshold value)
 *   - thresholds.van      : number | null  (very acute needs threshold value)
 *   - thresholds.an_label : string | null  (label for UI display only)
 *   - thresholds.van_label: string | null  (label for UI display only)
 *   Label fields are never used for validation.
 *
 * ─── Required indicator fields ────────────────────────────────────────────────
 *
 *   - indicator       : IND001..IND200
 *   - preference      : 1 | 2 | 3
 *   - factor_threshold: number
 *   - above_or_below  : "Above" | "Below"
 *   - type            : type-syntax string or null
 */

// ── Zod schemas ──────────────────────────────────────────────────────────────

/**
 * Accepts a type string matching the type syntax, or null.
 * When null the indicator has no type constraint and type-bound checks are skipped.
 */
export const IndicatorTypeSchema = z
	.string()
	.regex(INDICATOR_TYPE_REGEX, {
		message: "type must match: 'num', 'int', 'num[lb:ub]', 'num[lb+]', 'int[lb:ub]', or 'int[lb+]'"
	})
	.nullable();

const ThresholdsSchema = z
	.object({
		an: z.number({ invalid_type_error: 'thresholds.an must be a number' }).nullable(),
		an_label: z.string().nullable().optional(),
		van: z.number().nullable().optional(),
		van_label: z.string().nullable().optional()
	})
	.strict();

export const IndicatorSchema = z
	.object({
		indicator: z
			.string()
			.regex(INDICATOR_ID_REGEX, { message: 'indicator must be in format IND001..IND200' }),
		level: z.string().nullable().optional(),
		indicator_label: z.string().nullable().optional(),
		preference: z.nativeEnum(PreferenceEnum),
		type: IndicatorTypeSchema,
		metric: z.string().nullable().optional(),
		msna_module: z.string().nullable().optional(),
		msna_indicator: z.string().nullable().optional(),
		question_kobo_code: z.string().nullable().optional(),
		remarks_limitations: z.string().nullable().optional(),
		thresholds: ThresholdsSchema,
		factor_threshold: z
			.number({ invalid_type_error: 'factor_threshold must be a number' })
			.refine((v) => Number.isFinite(v), { message: 'factor_threshold must be finite' }),
		above_or_below: z.nativeEnum(AboveOrBelowEnum, {
			errorMap: () => ({ message: 'above_or_below must be "Above" or "Below"' })
		}),
		evidence_threshold: z.number().nullable().optional(),
		risk_concept: z.string().nullable().optional()
	})
	.superRefine((ind, ctx) => {
		const { thresholds } = ind;

		// ── Rule: van requires an ─────────────────────────────────────────────
		// This is a structural constraint on the JSON itself.
		// Type-bound checks (int/num, lb, ub) are performed at the CSV
		// validation stage in src/lib/processing/validator.js, not here.
		if (thresholds.van != null && thresholds.an == null) {
			ctx.addIssue({
				path: ['thresholds', 'van'],
				code: z.ZodIssueCode.custom,
				message: 'thresholds.van cannot be set without thresholds.an'
			});
		}
	})
	.strict();

const SubFactorSchema = z
	.object({
		id: z.string(),
		label: z.string().nullable().optional(),
		indicators: z.array(IndicatorSchema)
	})
	.strict();

const FactorSchema = z
	.object({
		id: z.string(),
		label: z.string().nullable().optional(),
		sub_factors: z.array(SubFactorSchema)
	})
	.strict();

const SystemSchema = z
	.object({
		id: z.nativeEnum(SystemIDEnum),
		label: z.string().nullable().optional(),
		factors: z.array(FactorSchema)
	})
	.strict();

export const IndicatorsRootSchema = z
	.object({
		generatedAt: z.string().datetime().optional(),
		systems: z.array(SystemSchema)
	})
	.strict();

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Validate & parse (throws ZodError if invalid).
 */
export function validateIndicatorsRoot(data: unknown): IndicatorsRoot {
	return IndicatorsRootSchema.parse(data) as IndicatorsRoot;
}

/**
 * Safe parse: returns `{ success: true, data }` or `{ success: false, error }`.
 */
export function safeValidateIndicatorsRoot(data: unknown) {
	return IndicatorsRootSchema.safeParse(data);
}

/**
 * Returns an array of user-friendly error messages from a failed Zod parse.
 * Useful for displaying validation errors in the UI.
 */
export function formatZodErrors(err: unknown): string[] {
	if (!err || typeof err !== 'object') return ['Unknown error'];
	const anyErr = err as Record<string, unknown>;
	if (Array.isArray(anyErr['issues'])) {
		return (anyErr['issues'] as Array<Record<string, unknown>>).map((issue) => {
			const path =
				Array.isArray(issue['path']) && issue['path'].length
					? (issue['path'] as unknown[]).join('.')
					: '(root)';
			return `${path}: ${issue['message']}`;
		});
	}
	if (typeof anyErr['message'] === 'string') return [anyErr['message']];
	return ['Validation failed'];
}
