import { tidy, mutate } from '@tidyjs/tidy';

/**
 * Extract indicator metadata from the flattened indicator map
 * @param {string[]} indicatorCodes - array of indicator codes (e.g., ['IND001', 'IND002'])
 * @param {Object} indicatorMap - flattened indicator map keyed by normalized code
 * @returns {Object} - map of indicator code to metadata
 */
export function extractIndicatorMetadata(indicatorCodes, indicatorMap) {
	const metadata = {};

	for (const code of indicatorCodes) {
		const normalizedCode = String(code).trim().toUpperCase();
		if (indicatorMap && indicatorMap[normalizedCode]) {
			metadata[normalizedCode] = indicatorMap[normalizedCode];
		}
	}

	return metadata;
}

/**
 * Determine if a value meets the acute needs (AN) threshold
 * @param {number|null} value - the indicator value (expected to be a number or null)
 * @param {Object} indicatorDef - indicator definition with thresholds (flattened entry or raw)
 * @returns {boolean|null} - true if above/meets threshold, false if below, null if unable to determine or missing
 */
function meetsThreshold(value, indicatorDef) {
	// Guard against missing/invalid indicatorDef or raw structure to avoid exceptions.
	if (!indicatorDef) return null;

	// indicatorDef may be the flattened entry (with a `.raw` field) or the raw indicator object itself.
	const raw = indicatorDef && indicatorDef.raw ? indicatorDef.raw : indicatorDef;

	// Ensure thresholds and above_or_below exist upstream; if not, bail out safely.
	if (!raw || !raw.thresholds || raw.thresholds.an === undefined || raw.thresholds.an === null)
		return null;
	if (raw.above_or_below === undefined || raw.above_or_below === null) return null;

	// Read values (safe now because of guards)
	const anThreshold = Number(raw.thresholds.an);
	if (Number.isNaN(anThreshold)) return null;

	// Expect value to be number or null. Null -> missing -> return null.
	if (value === null || value === undefined) return null;
	if (typeof value !== 'number') return null;

	// Compare based on the declared direction (case-insensitive)
	const dir = String(raw.above_or_below).trim().toLowerCase();

	if (dir === 'above') {
		return value >= anThreshold;
	} else if (dir === 'below') {
		return value <= anThreshold;
	}

	return null;
}

/**
 * flagData(items, indicatorMap)
 *
 * Accepts:
 *  - items: array of plain JS objects (each object is a row keyed by header names).
 *           Expected shape: { uoa: '...', IND001: 0.5, IND002: null, ... }
 *  - indicatorMap: flattened indicators map
 *
 * Returns:
 *  - an array of new objects where each original object has been augmented with
 *    `{indicator}_flag_an` boolean/null columns using tidy.js mutate.
 */
export function flagData(items, indicatorMap) {
	if (!Array.isArray(items)) return [];

	if (items.length === 0) return [];

	// Determine indicator keys from the first item (exclude 'uoa' case-insensitively)
	const first = items[0];
	const keys = Object.keys(first).filter((k) => String(k).trim().toLowerCase() !== 'uoa');

	// Extract metadata for keys (normalized)
	const metadata = extractIndicatorMetadata(keys, indicatorMap);

	// Fail fast: ensure metadata exists for every indicator key.
	// Flagging requires complete metadata (e.g. thresholds.an and above_or_below) for each indicator present in the input.
	for (const k of keys) {
		const normalized = String(k).trim().toUpperCase();
		if (!metadata[normalized]) {
			throw new Error(
				`Missing metadata for indicator '${normalized}'. Flagging requires complete metadata (thresholds.an and above_or_below).`
			);
		}
	}

	// Build mutate specification: for each indicator column add `{col}_flag_an`
	const mutateSpec = {};
	for (const k of keys) {
		const normalized = String(k).trim().toUpperCase();
		const def = metadata[normalized];
		const flagKey = `${k}_flag_an`;

		// Each mutate function receives the item (row) and returns the flag
		mutateSpec[flagKey] = (d) => {
			// d[k] is expected to be number or null (validator responsibility)
			return meetsThreshold(d[k], def);
		};
	}

	// Use tidy to add flag columns in a readable declarative way
	const result = tidy(items, mutate(mutateSpec));

	return result;
}

/**
 * Generate downloadable JSON from flagged data
 * @param {Object[]} flaggedData - data with threshold flags
 * @param {string} filename - output filename
 */
export function downloadJSON(flaggedData, filename = 'flagged_data.json') {
	const json = JSON.stringify(flaggedData, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
