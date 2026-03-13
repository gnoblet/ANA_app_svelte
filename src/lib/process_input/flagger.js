// @ts-nocheck
import { tidy, mutate } from '@tidyjs/tidy';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { buildSubfactorList } from './indicators.js';

/**
 * Extract indicator metadata from the flattened indicator map
 * @param {string[]} indicatorCodes - array of indicator codes (e.g., ['IND001', 'IND002'])
 * @param {Object} indicatorMap - flattened indicator map keyed by normalized code
 * @returns {Object} - map of indicator code to metadata
 */
/**
 * @param {string[]} indicatorCodes
 * @param {{ [k: string]: any }} indicatorMap
 * @returns {{ [k: string]: any }}
 */
export function extractIndicatorMetadata(indicatorCodes, indicatorMap) {
	/** @type {{ [k: string]: any }} */
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
/**
 * @param {Array<Record<string, number|null>>} items
 * @param {{ [k: string]: any }} indicatorMap
 * @param {{ systems: any[] }} indicatorsJson
 * @returns {Array<Record<string, any>>}
 */
export function flagData(items, indicatorMap, indicatorsJson) {
	if (!Array.isArray(items) || items.length === 0) return [];
	if (!indicatorsJson)
		throw new Error(
			'indicatorsJson is required; load it once during app init and pass it to flagData'
		);

	// Determine indicator keys from the first item (exclude 'uoa' case-insensitively)
	const first = items[0];
	const keys = Object.keys(first).filter((k) => String(k).trim().toLowerCase() !== 'uoa');

	// Extract metadata for keys (normalized)
	const metadata = extractIndicatorMetadata(keys, indicatorMap);
	// Build a lookup from normalized indicator code -> actual column name in the data
	const keyLookup = Object.fromEntries(keys.map((k) => [String(k).trim().toUpperCase(), k]));

	// Build mutate spec inline with threshold comparison logic
	// Each flag column is computed by checking the indicator value against its AN threshold
	// Also add a within_10perc column to check if value is within 10% distance of threshold
	// And add a within_10perc_change column for threshold not met but within 10%
	const mutateSpec = (() => {
		// Build per-indicator entries (same logic as before)
		const indicatorEntries = keys.flatMap((k) => {
			const normalized = String(k).trim().toUpperCase();
			/** @type {any} */
			const def = /** @type {any} */ (metadata[normalized]);
			const flagKey = `${k}_flag`;
			const flagLabel = `${k}_flag_label`;
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
					flagLabel,
					(d) => {
						// Use the boolean computed at flagKey as the source of truth.
						// null/undefined -> 'no_data', true -> 'flag', false -> 'no_flag'
						const flag = d[flagKey];
						if (flag === null || flag === undefined) return 'no_data';
						if (flag === true) return 'flag';
						if (flag === false) return 'noflag';
						return 'no_data';
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
		});

		// Build subfactor aggregation entries using the canonical list from indicators.js.
		// We rely on `buildSubfactorList(indicatorsJson)` to provide { path, codes } pairs
		// and then map those codes to actual data columns (case-insensitive via keyLookup).
		const subfactorEntries = [];
		const subList = buildSubfactorList(indicatorsJson);

		for (const { path, codes } of subList) {
			// Map JSON indicator codes to actual data column names (if present)
			const actualKeys = codes
				.map((c) => keyLookup[String(c).trim().toUpperCase()])
				.filter(Boolean);
			if (actualKeys.length === 0) continue;

			// missing_n: count raw missing values for indicators in this subfactor
			subfactorEntries.push([
				`${path}.missing_n`,
				(d) => {
					let cnt = 0;
					for (const col of actualKeys) {
						const v = d[col];
						if (v === null || v === undefined) cnt++;
					}
					return cnt;
				}
			]);

			// flag_n: count indicators whose computed flag is true
			subfactorEntries.push([
				`${path}.flag_n`,
				(d) => {
					let cnt = 0;
					for (const col of actualKeys) {
						if (d[`${col}_flag`] === true) cnt++;
					}
					return cnt;
				}
			]);

			// noflag_n: count indicators whose computed flag is false
			subfactorEntries.push([
				`${path}.noflag_n`,
				(d) => {
					let cnt = 0;
					for (const col of actualKeys) {
						if (d[`${col}_flag`] === false) cnt++;
					}
					return cnt;
				}
			]);
		}

		return Object.fromEntries([...indicatorEntries, ...subfactorEntries]);
	})();

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

/**
 * Generate downloadable XLSX from flagged data using ExcelJS
 * @param {Object[]} flaggedData - data with threshold flags
 * @param {string} filename - output filename
 */
export async function downloadXLSX(flaggedData, filename = 'data.xlsx') {
	// Create a new workbook and worksheet
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet('Flagged Data');

	// If no data, create an empty sheet with a header placeholder
	if (!Array.isArray(flaggedData) || flaggedData.length === 0) {
		worksheet.addRow(['No data']);
	} else {
		// Use the keys of the first object as column headers (preserves order)
		const headers = Object.keys(flaggedData[0]);

		// Set worksheet columns using headers (auto width can be adjusted if desired)
		worksheet.columns = headers.map((h) => ({
			header: h,
			key: h,
			width: Math.max(10, String(h).length + 2)
		}));

		// Add rows
		for (const row of flaggedData) {
			// Map values in header order to ensure consistent columns
			const rowValues = headers.map((h) => {
				const v = row[h];
				// ExcelJS expects plain values; convert objects/arrays to JSON strings
				if (v === null || v === undefined) return null;
				if (typeof v === 'object') return JSON.stringify(v);
				return v;
			});
			worksheet.addRow(rowValues);
		}

		// Optionally apply simple formatting: freeze header row
		worksheet.views = [{ state: 'frozen', ySplit: 1 }];
	}

	// Write workbook to an ArrayBuffer then trigger download
	try {
		const buffer = await workbook.xlsx.writeBuffer();
		const blob = new Blob([buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	} catch (err) {
		// Fallback: if ExcelJS fails in this environment, offer CSV download instead
		console.error('XLSX generation failed, falling back to CSV:', err);
		downloadCSV(flaggedData, filename.replace(/\.xlsx?$/i, '.csv'));
	}
}
