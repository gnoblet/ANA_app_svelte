/**
 * Simplified indicators utilities.
 *
 * - Keeps client-side fetch to load the static JSON at /data/indicators.json.
 * - Provides a minimal `flattenIndicators` that assumes the JSON shape is correct.
 * - Minimal runtime guards only (null checks).
 *
 * Exports:
 *  - loadIndicators() -> Promise<object>
 *  - flattenIndicators(json) -> Record<string, object>
 *  - getIndicator(map, id) -> object | undefined
 *  - extractIndicatorIdsForPath(json, systemId, factorId, subfactorId) -> string[]
 *  - buildSubfactorList(json) -> Array<{ path: string, codes: string[] }>
 */

import { asset } from '$app/paths';

/**
 * Load indicators.json from static folder.
 * Assumes the file exists and is valid (pre-validated before commit).
 * Uses asset() function to get the correct path with base URL automatically applied.
 */
export async function loadIndicators() {
	const url = asset('/data/indicators.json');
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch indicators JSON: ${res.status}`);
	return res.json();
}

/**
 * Flatten nested indicators JSON into a simple map keyed by indicator code (uppercased).
 * Minimal guards only.
 */
export function flattenIndicators(json) {
	const map = Object.create(null);
	if (!json || !Array.isArray(json.systems)) return map;

	for (const system of json.systems) {
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

function register(ind, map) {
	if (!ind || typeof ind !== 'object' || !ind.indicator) return;
	const key = String(ind.indicator).trim().toUpperCase();
	if (!key) return;
	map[key] = {
		indicator: key,
		type: ind.type ?? null,
		indicator_label: ind.indicator_label ?? null,
		metric: ind.metric ?? null,
		raw: ind
	};
}

/**
 * Lookup a flattened indicator map for an id (case-insensitive).
 */
export function getIndicator(map, id) {
	if (!map || !id) return undefined;
	return map[String(id).trim().toUpperCase()];
}

/**
 * Extract normalized indicator IDs (uppercased) for a given system/factor/subfactor path.
 *
 * Parameters:
 *   - json: full indicators.json structure
 *   - systemId: string (matches system.id)
 *   - factorId: string (matches factor.id)
 *   - subfactorId: string (matches sub_factors[].id)
 *
 * Returns:
 *   - array of indicator codes (uppercased) or [] if none found
 *
 * Notes:
 *   - Uses exact equality on ids after trimming. If you prefer to match by label
 *     or case-insensitive match, modify callers accordingly.
 */
export function extractIndicatorIdsForPath(json, systemId, factorId, subfactorId) {
	if (!json || !Array.isArray(json.systems)) return [];
	if (!systemId || !factorId || !subfactorId) return [];

	const sysId = String(systemId).trim();
	const facId = String(factorId).trim();
	const subId = String(subfactorId).trim();

	for (const system of json.systems) {
		if (!system || String(system.id ?? '').trim() !== sysId) continue;
		const factors = Array.isArray(system.factors) ? system.factors : [];
		for (const factor of factors) {
			if (!factor || String(factor.id ?? '').trim() !== facId) continue;
			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || String(sub.id ?? '').trim() !== subId) continue;
				// found the subfactor, collect indicators
				const codes = Array.isArray(sub.indicators)
					? sub.indicators
							.map((x) => {
								if (!x) return null;
								if (typeof x === 'string') return String(x).trim().toUpperCase();
								if (typeof x === 'object' && x.indicator)
									return String(x.indicator).trim().toUpperCase();
								return null;
							})
							.filter(Boolean)
					: [];
				return codes;
			}
		}
	}

	return [];
}

/**
 * Build a list of subfactors with their indicator codes and canonical path strings.
 *
 * Returns an array of objects: { path: "<system>.<factor>.<subfactor>", codes: [ 'IND001', ... ] }
 * - path components use `id` fields only (no fallback to labels).
 * - indicator codes are uppercased.
 */
export function buildSubfactorList(json) {
	const out = [];
	if (!json || !Array.isArray(json.systems)) return out;

	for (const system of json.systems) {
		if (!system || typeof system !== 'object') continue;
		const systemId = String(system.id ?? '').trim();
		if (!systemId) continue;

		const factors = Array.isArray(system.factors) ? system.factors : [];
		for (const factor of factors) {
			if (!factor || typeof factor !== 'object') continue;
			const factorId = String(factor.id ?? '').trim();
			if (!factorId) continue;

			// handle indicators directly under factor as an implicit subfactor (optional)
			if (Array.isArray(factor.indicators) && factor.indicators.length > 0) {
				const codes = factor.indicators
					.map((ind) => {
						if (!ind) return null;
						if (typeof ind === 'string') return String(ind).trim().toUpperCase();
						if (typeof ind === 'object' && ind.indicator)
							return String(ind.indicator).trim().toUpperCase();
						return null;
					})
					.filter(Boolean);
				if (codes.length > 0) {
					out.push({ path: `${systemId}.${factorId}`, codes });
				}
			}

			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || typeof sub !== 'object') continue;
				const subId = String(sub.id ?? '').trim();
				if (!subId) continue;

				const codes = Array.isArray(sub.indicators)
					? sub.indicators
							.map((x) => {
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
