/**
 * access_indicators.ts — OWNERSHIP: metadata lookup layer.
 *
 * Responsibility boundary:
 *  - Traversing the raw indicators.json structure to retrieve rich metadata
 *    objects (system, factor, subfactor, indicator).
 *  - ID path helpers for filtering views by system/factor/subfactor.
 *
 * Do NOT add fetch or flatten logic here. Use processing/indicators.ts instead.
 *
 * Note: buildSubfactorList exists in both files. The canonical implementation
 * lives in processing/indicators.ts (used by stores). The copy here is retained
 * for consumer convenience when access_indicators is the only import.
 *
 * Assumptions (strict):
 * - The JSON structure always follows: system -> factor -> subfactor -> indicator.
 *   There are no indicators directly under a factor (all indicators are inside
 *   `sub_factors[*].indicators`).
 * - Every indicator entry is represented with an object that has an `indicator`
 *   property whose value is the canonical ID (e.g. "IND001").
 * - Human-readable labels are stored in the `label` property for systems,
 *   factors and subfactors. Indicator entries may contain `indicator_label`.
 * - Path matching uses exact equality on `id` fields (no normalization performed).
 *
 * Exports:
 *  - getAllIndicatorIds(json) -> string[]
 *  - getIndicatorIdsForPath(json, systemId, factorId, subfactorId) -> string[]
 *  - buildSubfactorList(json) -> SubfactorEntry[]
 *  - getSystemMetadata(json, id) -> object | null
 *  - getFactorMetadata(json, systemId, factorId) -> object | null
 *  - getSubFactorMetadata(json, systemId, factorId, subfactorId) -> object | null
 *  - getIndicatorMetadata(json, id) -> object | null
 */

/* --------------------- Types --------------------- */

/** A set of indicators within a subfactor sharing the same threshold pair. */
export type ThresholdGroup = {
	factor_threshold: number;
	evidence_threshold: number;
	codes: string[];
};

export type SubfactorEntry = {
	path: string;
	codes: string[];       // flat list kept for backward compatibility
	groups: ThresholdGroup[];
};

/* --------------------- Private helpers --------------------- */

/** Extract indicator codes from an array of indicator entries. */
function extractCodesFromArray(arr: any[]): string[] {
	if (!Array.isArray(arr)) return [];
	const out: string[] = [];
	for (const entry of arr) {
		if (entry && typeof entry.indicator === 'string') out.push(entry.indicator);
	}
	return out;
}

/**
 * Build threshold groups from a subfactor's indicator array.
 * Indicators sharing the same (factor_threshold, evidence_threshold) pair are grouped.
 */
function buildThresholdGroups(indicators: any[]): ThresholdGroup[] {
	if (!Array.isArray(indicators)) return [];
	const groups = new Map<string, ThresholdGroup>();
	for (const ind of indicators) {
		if (!ind || typeof ind.indicator !== 'string') continue;
		const ft: number = ind.factor_threshold ?? 1;
		const et: number = ind.evidence_threshold ?? 1;
		const key = `${ft}:${et}`;
		if (!groups.has(key)) groups.set(key, { factor_threshold: ft, evidence_threshold: et, codes: [] });
		groups.get(key)!.codes.push(ind.indicator);
	}
	return Array.from(groups.values());
}

/* --------------------- Exports --------------------- */

/** Get a unique list (in encounter order) of all indicator IDs present in the JSON. */
export function getAllIndicatorIds(json: unknown): string[] {
	const j = json as any;
	const seen = new Set<string>();
	if (!j || !Array.isArray(j.systems)) return [];

	for (const system of j.systems) {
		if (!system || !Array.isArray(system.factors)) continue;
		for (const factor of system.factors) {
			if (!factor) continue;
			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || !Array.isArray(sub.indicators)) continue;
				for (const c of extractCodesFromArray(sub.indicators)) {
					if (!seen.has(c)) seen.add(c);
				}
			}
		}
	}

	return Array.from(seen);
}

/** Return indicator IDs for the given system/factor/subfactor path. Exact equality on id fields. */
export function getIndicatorIdsForPath(
	json: unknown,
	systemId: string,
	factorId: string,
	subfactorId: string
): string[] {
	const j = json as any;
	if (!j || !Array.isArray(j.systems)) return [];
	if (!systemId || !factorId || !subfactorId) return [];

	for (const system of j.systems) {
		if (!system || system.id !== systemId) continue;
		const factors = Array.isArray(system.factors) ? system.factors : [];
		for (const factor of factors) {
			if (!factor || factor.id !== factorId) continue;
			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || sub.id !== subfactorId) continue;
				return extractCodesFromArray(sub.indicators);
			}
		}
	}

	return [];
}

/**
 * Build a canonical list of subfactors with their indicator codes, path strings,
 * and threshold groups. Always emits three-part paths "systemId.factorId.subfactorId".
 */
export function buildSubfactorList(json: unknown): SubfactorEntry[] {
	const j = json as any;
	const out: SubfactorEntry[] = [];
	if (!j || !Array.isArray(j.systems)) return out;

	for (const system of j.systems) {
		if (!system || !Array.isArray(system.factors)) continue;
		const systemId = system.id;
		for (const factor of system.factors) {
			if (!factor) continue;
			const factorId = factor.id;
			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || !Array.isArray(sub.indicators)) continue;
				const codes = extractCodesFromArray(sub.indicators);
				if (codes.length === 0) continue;
				out.push({
					path: `${systemId}.${factorId}.${sub.id}`,
					codes,
					groups: buildThresholdGroups(sub.indicators)
				});
			}
		}
	}

	return out;
}

/** Find metadata for a system by id. Returns `{ systemId, raw, system_label }` or null. */
export function getSystemMetadata(json: unknown, systemId: string): Record<string, any> | null {
	const j = json as any;
	if (!j || !Array.isArray(j.systems) || !systemId) return null;
	for (const system of j.systems) {
		if (system?.id === systemId) {
			return { systemId: system.id, raw: system, system_label: system.label ?? null };
		}
	}
	return null;
}

/** Find metadata for a factor by systemId + factorId. Returns `{ systemId, factorId, raw, factor_label }` or null. */
export function getFactorMetadata(
	json: unknown,
	systemId: string,
	factorId: string
): Record<string, any> | null {
	const j = json as any;
	if (!j || !Array.isArray(j.systems) || !systemId || !factorId) return null;
	for (const system of j.systems) {
		if (!system || system.id !== systemId) continue;
		for (const factor of (Array.isArray(system.factors) ? system.factors : [])) {
			if (factor?.id === factorId) {
				return { systemId, factorId: factor.id, raw: factor, factor_label: factor.label ?? null };
			}
		}
	}
	return null;
}

/** Find metadata for a subfactor. Returns `{ systemId, factorId, subfactorId, raw, subfactor_label }` or null. */
export function getSubFactorMetadata(
	json: unknown,
	systemId: string,
	factorId: string,
	subfactorId: string
): Record<string, any> | null {
	const j = json as any;
	if (!j || !Array.isArray(j.systems) || !systemId || !factorId || !subfactorId) return null;
	for (const system of j.systems) {
		if (!system || system.id !== systemId) continue;
		for (const factor of (Array.isArray(system.factors) ? system.factors : [])) {
			if (!factor || factor.id !== factorId) continue;
			for (const sub of (Array.isArray(factor.sub_factors) ? factor.sub_factors : [])) {
				if (sub?.id === subfactorId) {
					return { systemId, factorId, subfactorId: sub.id, raw: sub, subfactor_label: sub.label ?? null };
				}
			}
		}
	}
	return null;
}

/* --------------------- Table helpers --------------------- */

export const INDICATOR_TABLE_COLUMNS = [
	'system',
	'factor',
	'subfactor',
	'indicator',
	'indicator_label',
	'level',
	'risk_concept',
	'type',
	'metric',
	'preference',
	'evidence_threshold',
	'factor_threshold',
	'above_or_below',
	'threshold_an',
	'threshold_van',
	'msna_module',
	'question_kobo_code',
	'remarks_limitations'
] as const;

/**
 * Flatten the full indicators JSON into a `{ columns, data }` shape ready for DataTable.
 * Each leaf indicator becomes one row; system/factor/subfactor labels are carried as context.
 * `thresholds.an` and `thresholds.van` are promoted to top-level columns.
 * Null/undefined values become empty strings.
 */
export function buildIndicatorRows(json: unknown): { columns: string[]; data: string[][] } {
	const columns = [...INDICATOR_TABLE_COLUMNS];
	const data: string[][] = [];

	const j = json as any;
	if (!j || !Array.isArray(j.systems)) return { columns, data };

	const str = (v: unknown): string => (v == null ? '' : String(v));

	for (const system of j.systems) {
		if (!system) continue;
		const systemLabel = str(system.label);
		for (const factor of Array.isArray(system.factors) ? system.factors : []) {
			if (!factor) continue;
			const factorLabel = str(factor.label);
			for (const sub of Array.isArray(factor.sub_factors) ? factor.sub_factors : []) {
				if (!sub || !Array.isArray(sub.indicators)) continue;
				const subfactorLabel = str(sub.label);
				for (const ind of sub.indicators) {
					if (!ind || typeof ind.indicator !== 'string') continue;
					const t = ind.thresholds ?? {};
					data.push([
						systemLabel,
						factorLabel,
						subfactorLabel,
						str(ind.indicator),
						str(ind.indicator_label),
						str(ind.level),
						str(ind.risk_concept),
						str(ind.type),
						str(ind.metric),
						str(ind.preference),
						str(ind.evidence_threshold),
						str(ind.factor_threshold),
						str(ind.above_or_below),
						str(t.an),
						str(t.van),
						str(ind.msna_module),
						str(ind.question_kobo_code),
						str(ind.remarks_limitations)
					]);
				}
			}
		}
	}

	return { columns, data };
}

/**
 * Find metadata for a single indicator id.
 * Returns `{ indicator, raw, systemId, factorId, subfactorId, indicator_label }` or null.
 */
export function getIndicatorMetadata(json: unknown, id: string): Record<string, any> | null {
	const j = json as any;
	if (!id || !j || !Array.isArray(j.systems)) return null;

	for (const system of j.systems) {
		if (!system || !Array.isArray(system.factors)) continue;
		const systemId = system.id;
		for (const factor of system.factors) {
			if (!factor) continue;
			const factorId = factor.id;
			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || !Array.isArray(sub.indicators)) continue;
				for (const ind of sub.indicators) {
					if (!ind || typeof ind.indicator !== 'string') continue;
					if (ind.indicator === id) {
						return {
							indicator: ind.indicator,
							raw: ind,
							systemId,
							factorId,
							subfactorId: sub.id,
							indicator_label: ind.indicator_label ?? null
						};
					}
				}
			}
		}
	}

	return null;
}
