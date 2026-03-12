/**
 * Simplified indicators utilities.
 *
 * - Keeps client-side fetch to load the static JSON at /data/indicators.json.
 * - Provides a minimal `flattenIndicators` that assumes the JSON shape is correct.
 * - Minimal runtime guards only (null checks).
 *
 * Exports:
 *  - loadIndicators(url = '/data/indicators.json') -> Promise<object>
 *  - flattenIndicators(json) -> Record<string, object>
 *  - getIndicator(map, id) -> object | undefined
 */

/**
 * Load indicators.json from static folder.
 * Assumes the file exists and is valid (pre-validated before commit).
 */
export async function loadIndicators(url = './data/indicators.json') {
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
