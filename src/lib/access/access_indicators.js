/**
 * Minimal, self-contained helpers to access indicator IDs and metadata from the
 * raw indicators.json structure.
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
 *  - getAllIndicatorIds(json) -> string[]       (unique, in encounter order)
 *  - getIndicatorIdsForPath(json, systemId, factorId, subfactorId) -> string[]
 *  - buildSubfactorList(json) -> Array<{ path: string, codes: string[] }>
 *  - getSystemMetadata(json, id) -> object | null
 *  - getFactorMetadata(json, systemId, factorId) -> object | null
 *  - getSubFactorMetadata(json, systemId, factorId, subfactorId) -> object | null
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
		// Assume entry.indicator exists and is the canonical ID string (per your validation)
		if (typeof entry.indicator === 'string') {
			out.push(entry.indicator);
		}
	}
	return out;
}

/**
 * Get a unique list (in encounter order) of all indicator IDs present in the JSON.
 * Traverses system -> factor -> subfactor -> indicators only.
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
 * Always emits three-part paths "systemId.factorId.subfactorId" because indicators
 * are assumed to always live under subfactors.
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
 * Find metadata for a system by id.
 * Returns: { systemId, raw: <system object>, system_label } or null.
 * Matching is exact on id.
 *
 * @param {Object} json
 * @param {string} systemId
 * @returns {Object|null}
 */
export function getSystemMetadata(json, systemId) {
	if (!json || !Array.isArray(json.systems) || !systemId) return null;
	for (const system of json.systems) {
		if (!system) continue;
		if (system.id === systemId) {
			return {
				systemId: system.id,
				raw: system,
				// labels in your indicators.json use `label`
				system_label: system.label ?? null
			};
		}
	}
	return null;
}

/**
 * Find metadata for a factor by systemId + factorId.
 * Returns: { systemId, factorId, raw: <factor object>, factor_label } or null.
 * Matching is exact on ids.
 *
 * @param {Object} json
 * @param {string} systemId
 * @param {string} factorId
 * @returns {Object|null}
 */
export function getFactorMetadata(json, systemId, factorId) {
	if (!json || !Array.isArray(json.systems) || !systemId || !factorId) return null;
	for (const system of json.systems) {
		if (!system || system.id !== systemId) continue;
		const factors = Array.isArray(system.factors) ? system.factors : [];
		for (const factor of factors) {
			if (!factor) continue;
			if (factor.id === factorId) {
				return {
					systemId,
					factorId: factor.id,
					raw: factor,
					// labels in your indicators.json use `label`
					factor_label: factor.label ?? null
				};
			}
		}
	}
	return null;
}

/**
 * Find metadata for a subfactor by systemId + factorId + subfactorId.
 * Returns: { systemId, factorId, subfactorId, raw: <subfactor object>, subfactor_label } or null.
 * Matching is exact on ids.
 *
 * @param {Object} json
 * @param {string} systemId
 * @param {string} factorId
 * @param {string} subfactorId
 * @returns {Object|null}
 */
export function getSubFactorMetadata(json, systemId, factorId, subfactorId) {
	if (!json || !Array.isArray(json.systems) || !systemId || !factorId || !subfactorId) return null;
	for (const system of json.systems) {
		if (!system || system.id !== systemId) continue;
		const factors = Array.isArray(system.factors) ? system.factors : [];
		for (const factor of factors) {
			if (!factor || factor.id !== factorId) continue;
			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub) continue;
				if (sub.id === subfactorId) {
					return {
						systemId,
						factorId,
						subfactorId: sub.id,
						raw: sub,
						// labels in your indicators.json use `label`
						subfactor_label: sub.label ?? null
					};
				}
			}
		}
	}
	return null;
}

/**
 * Find metadata for a single indicator id in the JSON.
 * Returns an object:
 *  { indicator: id, raw: <original entry object>, systemId, factorId, subfactorId, indicator_label }
 * or null when not found.
 *
 * Matching is exact on the id string (no normalization).
 *
 * This implementation only inspects subfactor indicator arrays (per strict assumption).
 *
 * @param {Object} json
 * @param {string} id
 * @returns {Object|null}
 */
export function getIndicatorMetadata(json, id) {
	if (!id || !json || !Array.isArray(json.systems)) return null;

	// Iterate systems/factors/subfactors to preserve encounter order (first match wins)
	for (const system of json.systems) {
		if (!system || !Array.isArray(system.factors)) continue;
		const systemId = system.id;

		for (const factor of system.factors) {
			if (!factor) continue;
			const factorId = factor.id;

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
