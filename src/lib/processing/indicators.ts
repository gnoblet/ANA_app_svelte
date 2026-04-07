/**
 * indicators.ts — OWNERSHIP: fetch + flatten layer.
 *
 * Responsibility boundary:
 *  - Fetching `indicators.json` from static/ via SvelteKit's asset().
 *  - Flattening the hierarchy into a keyed map (Record<string, object>).
 *  - Low-level ID extraction helpers used by stores (indicatorsStore).
 *
 * Do NOT add metadata-lookup helpers here. Use access_indicators.js instead.
 *
 * Exports:
 *  - loadIndicators() -> Promise<object>
 *  - flattenIndicators(json) -> Record<string, IndicatorEntry>
 *  - getIndicator(map, id) -> IndicatorEntry | undefined
 *  - extractIndicatorIdsForPath(json, systemId, factorId, subfactorId) -> string[]
 *  - buildSubfactorList(json) -> Array<{ path: string, codes: string[] }>
 *    (canonical source — access_indicators.js delegates here for its own buildSubfactorList)
 */

import { asset } from '$app/paths';

/* --------------------- Types --------------------- */

export type IndicatorEntry = {
	indicator: string;
	type: string | null;
	indicator_label: string | null;
	metric: string | null;
	raw: unknown;
};

/* --------------------- Fetch --------------------- */

/** Load indicators.json from static folder. */
export async function loadIndicators(init?: RequestInit): Promise<unknown> {
	const url = asset('/data/indicators.json');
	const res = await fetch(url, init);
	if (!res.ok) throw new Error(`Failed to fetch indicators JSON: ${res.status}`);
	return res.json();
}

/* --------------------- Flatten --------------------- */

/**
 * Flatten nested indicators JSON into a simple map keyed by indicator code (uppercased).
 * Minimal guards only.
 */
export function flattenIndicators(json: unknown): Record<string, IndicatorEntry> {
	const map: Record<string, IndicatorEntry> = Object.create(null);
	const j = json as any;
	if (!j || !Array.isArray(j.systems)) return map;

	for (const system of j.systems) {
		if (!system || typeof system !== 'object') continue;
		const factors = Array.isArray(system.factors) ? system.factors : [];
		for (const factor of factors) {
			if (!factor || typeof factor !== 'object') continue;

			// indicators directly on factor
			if (Array.isArray(factor.indicators)) {
				for (const ind of factor.indicators) register(ind, map);
			}

			// indicators under sub_factors
			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || !Array.isArray(sub.indicators)) continue;
				for (const ind of sub.indicators) register(ind, map);
			}
		}
	}

	return map;
}

function register(ind: unknown, map: Record<string, IndicatorEntry>): void {
	const i = ind as any;
	if (!i || typeof i !== 'object' || !i.indicator) return;
	const key = String(i.indicator).trim().toUpperCase();
	if (!key) return;
	map[key] = {
		indicator: key,
		type: i.type ?? null,
		indicator_label: i.indicator_label ?? null,
		metric: i.metric ?? null,
		raw: i
	};
}

/* --------------------- Lookup --------------------- */

/** Lookup a flattened indicator map for an id (case-insensitive). */
export function getIndicator(
	map: Record<string, IndicatorEntry>,
	id: string
): IndicatorEntry | undefined {
	if (!map || !id) return undefined;
	return map[String(id).trim().toUpperCase()];
}

/* --------------------- Path helpers --------------------- */

/**
 * Extract normalized indicator IDs (uppercased) for a given system/factor/subfactor path.
 * Uses exact equality on ids after trimming.
 */
export function extractIndicatorIdsForPath(
	json: unknown,
	systemId: string,
	factorId: string,
	subfactorId: string
): string[] {
	const j = json as any;
	if (!j || !Array.isArray(j.systems)) return [];
	if (!systemId || !factorId || !subfactorId) return [];

	const sysId = String(systemId).trim();
	const facId = String(factorId).trim();
	const subId = String(subfactorId).trim();

	for (const system of j.systems) {
		if (!system || String(system.id ?? '').trim() !== sysId) continue;
		const factors = Array.isArray(system.factors) ? system.factors : [];
		for (const factor of factors) {
			if (!factor || String(factor.id ?? '').trim() !== facId) continue;
			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || String(sub.id ?? '').trim() !== subId) continue;
				return Array.isArray(sub.indicators)
					? sub.indicators
							.map((x: any) => {
								if (!x) return null;
								if (typeof x === 'string') return String(x).trim().toUpperCase();
								if (typeof x === 'object' && x.indicator)
									return String(x.indicator).trim().toUpperCase();
								return null;
							})
							.filter(Boolean)
					: [];
			}
		}
	}

	return [];
}

/**
 * Build a list of subfactors with their indicator codes and canonical path strings.
 * Returns `{ path: "<system>.<factor>.<subfactor>", codes: ['IND001', ...] }`.
 */
export function buildSubfactorList(json: unknown): Array<{ path: string; codes: string[] }> {
	const out: Array<{ path: string; codes: string[] }> = [];
	const j = json as any;
	if (!j || !Array.isArray(j.systems)) return out;

	for (const system of j.systems) {
		if (!system || typeof system !== 'object') continue;
		const systemId = String(system.id ?? '').trim();
		if (!systemId) continue;

		const factors = Array.isArray(system.factors) ? system.factors : [];
		for (const factor of factors) {
			if (!factor || typeof factor !== 'object') continue;
			const factorId = String(factor.id ?? '').trim();
			if (!factorId) continue;

			// indicators directly under factor as an implicit subfactor
			if (Array.isArray(factor.indicators) && factor.indicators.length > 0) {
				const codes = factor.indicators
					.map((ind: any) => {
						if (!ind) return null;
						if (typeof ind === 'string') return String(ind).trim().toUpperCase();
						if (typeof ind === 'object' && ind.indicator)
							return String(ind.indicator).trim().toUpperCase();
						return null;
					})
					.filter(Boolean);
				if (codes.length > 0) out.push({ path: `${systemId}.${factorId}`, codes });
			}

			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || typeof sub !== 'object') continue;
				const subId = String(sub.id ?? '').trim();
				if (!subId) continue;

				const codes = Array.isArray(sub.indicators)
					? sub.indicators
							.map((x: any) => {
								if (!x) return null;
								if (typeof x === 'string') return String(x).trim().toUpperCase();
								if (typeof x === 'object' && x.indicator)
									return String(x.indicator).trim().toUpperCase();
								return null;
							})
							.filter(Boolean)
					: [];
				if (codes.length === 0) continue;

				out.push({ path: `${systemId}.${factorId}.${subId}`, codes });
			}
		}
	}

	return out;
}
