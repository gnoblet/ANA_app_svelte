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
 * @param {number} value - the indicator value
 * @param {Object} indicatorDef - indicator definition with thresholds
 * @returns {boolean|null} - true if above/meets threshold, false if below, null if unable to determine
 */
function meetsThreshold(value, indicatorDef) {
	if (!indicatorDef || !indicatorDef.thresholds) return null;

	const thresholds = indicatorDef.thresholds;
	const anThreshold = thresholds.an;
	const aboveOrBelow = indicatorDef.above_or_below;

	if (anThreshold === null || anThreshold === undefined) return null;

	const numValue = Number(value);
	if (Number.isNaN(numValue)) return null;

	if (aboveOrBelow === 'Above') {
		return numValue >= anThreshold;
	} else if (aboveOrBelow === 'Below') {
		return numValue <= anThreshold;
	}

	return null;
}

/**
 * Process CSV data and add threshold flags
 * @param {string[]} header - CSV header row
 * @param {string[][]} rows - CSV data rows
 * @param {Object} indicatorMap - flattened indicator map
 * @returns {Object[]} - tidy data with flagged columns
 */
export function flagData(header, rows, indicatorMap) {
	// Find UOA column
	const uoaIndex = header.findIndex((h) => String(h).trim().toLowerCase() === 'uoa');

	if (uoaIndex === -1) {
		throw new Error('UOA column not found');
	}

	// Get indicator columns (everything except UOA)
	const indicatorIndices = header.map((h, idx) => idx).filter((idx) => idx !== uoaIndex);

	// Extract metadata for all indicators
	const indicatorCodes = indicatorIndices.map((idx) => header[idx]);
	const metadata = extractIndicatorMetadata(indicatorCodes, indicatorMap);

	// Convert rows to objects
	const data = rows.map((row) => {
		const obj = { uoa: row[uoaIndex] };

		// Add each indicator column with its value
		indicatorIndices.forEach((idx) => {
			const indicatorCode = header[idx];
			const value = row[idx] || '';
			obj[indicatorCode] = value;
		});

		return obj;
	});

	// Build mutate object dynamically for all flag columns
	const mutateObj = {};
	indicatorIndices.forEach((idx) => {
		const indicatorCode = header[idx];
		const normalizedCode = String(indicatorCode).trim().toUpperCase();
		const indicatorDef = metadata[normalizedCode];
		const flagColumnName = `${indicatorCode}_flag_an`;

		mutateObj[flagColumnName] = (d) => meetsThreshold(d[indicatorCode], indicatorDef);
	});

	// Use tidy to add flag columns
	const tidyData = tidy(data, mutate(mutateObj));

	return tidyData;
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
