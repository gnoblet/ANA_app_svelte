import { tidy, mutate } from '@tidyjs/tidy';
import Papa from 'papaparse';

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
	// Also add a within_10perc column to check if value is within 10% distance of threshold
	// And add a within_10perc_change column for threshold not met but within 10%
	const mutateSpec = Object.fromEntries(
		keys.flatMap((k) => {
			const normalized = String(k).trim().toUpperCase();
			const def = metadata[normalized];
			const flagKey = `${k}_flag_an`;
			const within10percKey = `${k}_within_10perc`;
			const within10percChangeKey = `${k}_within_10perc_change`;

			return [
				[
					flagKey,
					(d) => {
						// Upstream validation ensures thresholds.an and above_or_below exist and are valid
						const value = d[k];
						const raw = def && def.raw ? def.raw : def;

						// Value is null/missing -> return null
						if (value === null || value === undefined) return null;

						// Value must be a number (validator responsibility)
						if (typeof value !== 'number') return null;

						// Direct comparison (thresholds and direction validated upstream)
						const anThreshold = raw.thresholds.an;

						// Was the threshold met?
						if (raw.above_or_below === 'Above') {
							return value >= anThreshold;
						} else if (raw.above_or_below === 'Below') {
							return value <= anThreshold;
						}

						return null;
					}
				],
				[
					within10percKey,
					(d) => {
						// Check if value is within 10% distance of threshold
						// Formula: abs(value - threshold) / threshold <= 0.1
						const value = d[k];
						const raw = def && def.raw ? def.raw : def;

						// Value is null/missing -> return null
						if (value === null || value === undefined) return null;

						// Value must be a number
						if (typeof value !== 'number') return null;

						const anThreshold = raw.thresholds.an;

						// Avoid division by zero
						if (anThreshold === 0) return value === 0;

						// Check if percentage distance is <= 10%
						const percentDistance = Math.abs((value - anThreshold) / anThreshold);
						return percentDistance <= 0.1;
					}
				],
				[
					within10percChangeKey,
					(d) => {
						// Check if threshold NOT met but within 10% distance
						// This indicates a value that failed but is close to passing
						const value = d[k];
						const raw = def && def.raw ? def.raw : def;

						// Value is null/missing -> return null
						if (value === null || value === undefined) return null;

						// Value must be a number
						if (typeof value !== 'number') return null;

						const anThreshold = raw.thresholds.an;

						// Avoid division by zero
						if (anThreshold === 0) return false;

						// Calculate percentage distance
						const percentDistance = Math.abs((value - anThreshold) / anThreshold);

						// Check if within 10% AND threshold not met
						const thresholdMet =
							raw.above_or_below === 'Above' ? value >= anThreshold : value <= anThreshold;

						return percentDistance <= 0.1 && !thresholdMet;
					}
				]
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

/**
 * Generate downloadable JSON from flagged data
 * @param {Object[]} flaggedData - data with threshold flags
 * @param {string} filename - output filename
 */
export function downloadCSV(flaggedData, filename = 'data.csv') {
	const csv = Papa.unparse(flaggedData);
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
