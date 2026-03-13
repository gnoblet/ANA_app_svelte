/**
 * Minimal, self-contained helpers to access indicator IDs and metadata from the
 * raw indicators.json structure.
 *
 * Assumptions (intentionally minimal because your indicators.json is validated beforehand):
 * - Every indicator entry is represented with an object that has an `indicator` property
 *   whose value is the canonical ID (e.g. "IND001").
 * - Path matching uses exact equality on `id` fields (no normalization performed).
 *
 * Exports:
 *  - getAllIndicatorIds(json) -> string[]       (unique, in encounter order)
 *  - getIndicatorIdsForPath(json, systemId, factorId, subfactorId) -> string[]
 *  - buildSubfactorList(json) -> Array<{ path: string, codes: string[] }>
 *  - getIndicatorMetadata(json, id) -> object | null
 */

/**
 * Extract indicator codes from an array of indicator entries.
 * Assumes entries are objects with an `indicator` property (validated upstream).
 * Returns codes exactly as found (no normalization).
 *
 * @param {Array} arr
 * @returns {string[]}
 */
function extractCodesFromArray(arr) {
	if (!Array.isArray(arr)) return [];
	const out = [];
	for (const entry of arr) {
		if (!entry) continue;
		// Assume entry.indicator exists and is the canonical ID string (per indicators.json validation)
		if (typeof entry.indicator === 'string') {
			out.push(entry.indicator);
		}
	}
	return out;
}

/**
 * Get a unique list (in encounter order) of all indicator IDs present in the JSON.
 * No normalization or validation is performed beyond simple traversal.
 *
 * @param {Object} json
 * @returns {string[]}
 */
export function getAllIndicatorIds(json) {
	const seen = new Set();
	if (!json || !Array.isArray(json.systems)) return [];

	for (const system of json.systems) {
		if (!system || !Array.isArray(system.factors)) continue;
		for (const factor of system.factors) {
			if (!factor) continue;

			if (Array.isArray(factor.indicators)) {
				for (const c of extractCodesFromArray(factor.indicators)) {
					if (!seen.has(c)) seen.add(c);
				}
			}

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

/**
 * Return indicator IDs for the given system/factor/subfactor path.
 * Matches are performed with exact equality on the `id` fields (no trimming/normalizing).
 *
 * @param {Object} json
 * @param {string} systemId
 * @param {string} factorId
 * @param {string} subfactorId
 * @returns {string[]}
 */
export function getIndicatorIdsForPath(json, systemId, factorId, subfactorId) {
	if (!json || !Array.isArray(json.systems)) return [];
	if (!systemId || !factorId || !subfactorId) return [];

	for (const system of json.systems) {
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
 * Build a canonical list of subfactors with their indicator codes and path strings.
 * - For indicators directly under a factor (factor.indicators), the path emitted is "systemId.factorId".
 * - For subfactor indicators, the path emitted is "systemId.factorId.subfactorId".
 *
 * @param {Object} json
 * @returns {Array<{ path: string, codes: string[] }>}
 */
export function buildSubfactorList(json) {
	const out = [];
	if (!json || !Array.isArray(json.systems)) return out;

	for (const system of json.systems) {
		if (!system || !Array.isArray(system.factors)) continue;
		const systemId = system.id;
		for (const factor of system.factors) {
			if (!factor) continue;
			const factorId = factor.id;

			if (Array.isArray(factor.indicators) && factor.indicators.length > 0) {
				const codes = extractCodesFromArray(factor.indicators);
				if (codes.length > 0) out.push({ path: `${systemId}.${factorId}`, codes });
			}

			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || !Array.isArray(sub.indicators)) continue;
				const subId = sub.id;
				const codes = extractCodesFromArray(sub.indicators);
				if (codes.length === 0) continue;
				out.push({ path: `${systemId}.${factorId}.${subId}`, codes });
			}
		}
	}

	return out;
}

/**
 * Find metadata for a single indicator id in the JSON.
 * Returns an object:
 *  { indicator: id, raw: <original entry object>, systemId, factorId, subfactorId, indicator_label }
 * or null when not found.
 *
 * Matching is exact on the id string (no normalization).
 *
 * @param {Object} json
 * @param {string} id
 * @returns {Object|null}
 */
export function getIndicatorMetadata(json, id) {
	if (!id || !json || !Array.isArray(json.systems)) return null;

	for (const system of json.systems) {
		if (!system || !Array.isArray(system.factors)) continue;
		const systemId = system.id;
		for (const factor of system.factors) {
			if (!factor) continue;
			const factorId = factor.id;

			if (Array.isArray(factor.indicators)) {
				for (const ind of factor.indicators) {
					if (!ind || typeof ind.indicator !== 'string') continue;
					if (ind.indicator === id) {
						return {
							indicator: ind.indicator,
							raw: ind,
							systemId,
							factorId,
							subfactorId: null,
							indicator_label: ind.indicator_label ?? null
						};
					}
				}
			}

			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || !Array.isArray(sub.indicators)) continue;
				const subId = sub.id;
				for (const ind of sub.indicators) {
					if (!ind || typeof ind.indicator !== 'string') continue;
					if (ind.indicator === id) {
						return {
							indicator: ind.indicator,
							raw: ind,
							systemId,
							factorId,
							subfactorId: subId,
							indicator_label: ind.indicator_label ?? null
						};
					}
				}
			}
		}
	}

	return null;
}
