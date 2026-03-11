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
 *
 * Threshold comparison logic is inlined directly in the mutate spec for clarity.
 */
export function flagData(items, indicatorMap) {
	if (!Array.isArray(items) || items.length === 0) return [];

	// Determine indicator keys from the first item (exclude 'uoa' case-insensitively)
	const first = items[0];
	const keys = Object.keys(first).filter((k) => String(k).trim().toLowerCase() !== 'uoa');

	// Extract metadata for keys (normalized)
	const metadata = extractIndicatorMetadata(keys, indicatorMap);

	// Build mutate spec inline with threshold comparison logic
	// Each flag column is computed by checking the indicator value against its AN threshold
	const mutateSpec = Object.fromEntries(
		keys.map((k) => {
			const normalized = String(k).trim().toUpperCase();
			const def = metadata[normalized];
			const flagKey = `${k}_flag_an`;

			return [
				flagKey,
				(d) => {
					// Inline threshold comparison logic
					const value = d[k];
					const raw = def && def.raw ? def.raw : def;

					// Guard: missing metadata or thresholds
					if (
						!raw ||
						!raw.thresholds ||
						raw.thresholds.an === undefined ||
						raw.thresholds.an === null
					)
						return null;
					if (raw.above_or_below === undefined || raw.above_or_below === null) return null;

					// Guard: invalid threshold value
					const anThreshold = Number(raw.thresholds.an);
					if (Number.isNaN(anThreshold)) return null;

					// Guard: value must be number (null -> return null for missing)
					if (value === null || value === undefined) return null;
					if (typeof value !== 'number') return null;

					// Compare based on direction
					const dir = String(raw.above_or_below).trim().toLowerCase();
					if (dir === 'above') {
						return value >= anThreshold;
					} else if (dir === 'below') {
						return value <= anThreshold;
					}

					return null;
				}
			];
		})
	);

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
