import { z } from 'zod';
import { SystemIDEnum, SystemIDs, SystemID } from './generated/system-enum';
import { FactorIDEnum, FactorIDs, FactorID } from './generated/factor-enum';
import { SubFactorIDEnum, SubFactorIDs, SubFactorID } from './generated/subfactor-enum';

/**
 * TypeScript types (exports) and zod runtime schemas for the nested indicators JSON.
 *
 * - Use `validateIndicatorsRoot` to parse & validate (throws on invalid).
 * - Use `safeValidateIndicatorsRoot` to get a non-throwing result.
 *
 * Required indicator fields enforced by the schema:
 *  - `indicator`: must match IND001..IND200
 *  - `type`: must be either 'num_above_0' or 'prop'
 *  - `preference`: integer 1, 2 or 3
 *  - `factor_threshold`: number
 *
 * Thresholds: `thresholds.an` and `thresholds.van` are optional numbers (nullable).
 * For `type === 'prop'` you should store proportions (0..1) in the JSON; the schema
 * additionally enforces that when `type === 'prop'` numeric thresholds are within 0..1.
 */

/* ----- TypeScript interfaces ----- */
export type IndicatorID = string;
export enum IndicatorTypeEnum {
	NumAbove0 = 'num_above_0',
	Prop = 'prop',
	Binary = 'binary'
}
export type IndicatorType = IndicatorTypeEnum;

export enum PreferenceEnum {
	One = 1,
	Two = 2,
	Three = 3
}

export enum AboveOrBelowEnum {
	Above = 'Above',
	Below = 'Below'
}
export const IndicatorTypeSchema = z.nativeEnum(IndicatorTypeEnum);

export interface Indicator {
	indicator: IndicatorID;
	level?: string | null;
	indicator_label?: string | null;
	preference: PreferenceEnum;
	type: IndicatorType;
	metric?: string | null;
	msna_module?: string | null;
	msna_indicator?: string | null;
	question_kobo_code?: string | null;
	remarks_limitations?: string | null;
	thresholds: { an: number; van?: number | null };
	factor_threshold: number;
	above_or_below: AboveOrBelowEnum;
	evidence_threshold?: number | null;
	risk_concept?: string | null;
}

export interface SubFactor {
	id: SubFactorID;
	label?: string | null;
	indicators: Indicator[];
}

export interface Factor {
	id: FactorID;
	label?: string | null;
	sub_factors: SubFactor[];
}

// SystemIDEnum is generated into src/lib/types/generated/system-enum.ts
// and imported at the top of this file. Use the imported `SystemID` type.

export interface System {
	id: SystemID;
	label?: string | null;
	factors: Factor[];
}

export interface IndicatorsRoot {
	systems: System[];
}

/* ----- zod runtime schemas ----- */

/**
 * Valid indicator IDs: IND001 .. IND200
 * - 001..009  -> 00[1-9]
 * - 010..099  -> 0[1-9][0-9]
 * - 100..199  -> 1[0-9]{2}
 * - 200       -> 200
 */
export const INDICATOR_ID_REGEX = /^IND(?:00[1-9]|0[1-9][0-9]|1[0-9]{2}|200)$/;

const ThresholdsSchema = z
	.object({
		an: z.number({ invalid_type_error: 'thresholds.an must be a number' }),
		van: z.number().nullable().optional()
	})
	.strict();

const IndicatorSchema = z
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
		// If type is 'prop', require that numeric thresholds (if present) are within 0..1
		if (ind.type === IndicatorTypeEnum.Prop && ind.thresholds) {
			const { an, van } = ind.thresholds;
			if (typeof an === 'number') {
				if (!(an >= 0 && an <= 1)) {
					ctx.addIssue({
						path: ['thresholds', 'an'],
						code: z.ZodIssueCode.custom,
						message: 'For prop type thresholds.an must be between 0 and 1 (proportion)'
					});
				}
			}
			if (typeof van === 'number') {
				if (!(van >= 0 && van <= 1)) {
					ctx.addIssue({
						path: ['thresholds', 'van'],
						code: z.ZodIssueCode.custom,
						message: 'For prop type thresholds.van must be between 0 and 1 (proportion)'
					});
				}
			}
		}

		// If type is 'num_above_0', require that numeric thresholds (if present) are numbers > 0 (not necessarily integers)
		if (ind.type === IndicatorTypeEnum.NumAbove0 && ind.thresholds) {
			const { an, van } = ind.thresholds;
			if (typeof an === 'number') {
				if (!Number.isFinite(an) || an <= 0) {
					ctx.addIssue({
						path: ['thresholds', 'an'],
						code: z.ZodIssueCode.custom,
						message: 'For num_above_0 type thresholds.an must be a number greater than 0'
					});
				}
			}
			if (typeof van === 'number') {
				if (!Number.isFinite(van) || van <= 0) {
					ctx.addIssue({
						path: ['thresholds', 'van'],
						code: z.ZodIssueCode.custom,
						message: 'For num_above_0 type thresholds.van must be a number greater than 0'
					});
				}
			}
		}

		// If type is 'binary', require that numeric thresholds (if present) are numeric 0 or 1 (integers are allowed but not required)
		if (ind.type === IndicatorTypeEnum.Binary && ind.thresholds) {
			const { an, van } = ind.thresholds;
			if (typeof an === 'number') {
				if (!Number.isFinite(an) || (an !== 0 && an !== 1)) {
					ctx.addIssue({
						path: ['thresholds', 'an'],
						code: z.ZodIssueCode.custom,
						message: 'For binary type thresholds.an must be numeric 0 or 1'
					});
				}
			}
			if (typeof van === 'number') {
				if (!Number.isFinite(van) || (van !== 0 && van !== 1)) {
					ctx.addIssue({
						path: ['thresholds', 'van'],
						code: z.ZodIssueCode.custom,
						message: 'For binary type thresholds.van must be numeric 0 or 1'
					});
				}
			}
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
		systems: z.array(SystemSchema)
	})
	.strict();

/* ----- helpers ----- */

/**
 * Validate & parse (throws zod error if invalid)
 */
export function validateIndicatorsRoot(data: unknown): IndicatorsRoot {
	return IndicatorsRootSchema.parse(data);
}

/**
 * Safe parse: returns { success, data | error }
 */
export function safeValidateIndicatorsRoot(data: unknown) {
	return IndicatorsRootSchema.safeParse(data);
}

/**
 * Minimal helper that returns an array of user-friendly messages from a failed parse;
 * useful for showing validation errors in UI.
 */
export function formatZodErrors(err: unknown): string[] {
	if (!err || typeof err !== 'object') return ['Unknown error'];
	// If it's a ZodError, it will have `issues`
	const anyErr = err as any;
	if (anyErr.issues && Array.isArray(anyErr.issues)) {
		return anyErr.issues.map((issue: any) => {
			const p = issue.path && issue.path.length ? issue.path.join('.') : '(root)';
			return `${p}: ${issue.message}`;
		});
	}
	if (anyErr.message && typeof anyErr.message === 'string') return [anyErr.message];
	return ['Validation failed'];
}
