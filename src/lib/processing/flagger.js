// @ts-nocheck
import { tidy, mutate } from '@tidyjs/tidy';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { buildSubfactorList, getIndicatorMetadata } from '../access/access_indicators.js';

/**
 * New, breaking-version of flagger.js that uses access_indicators.js semantics.
 *
 * Key contracts (breaking):
 *  - Data columns MUST be the canonical indicator IDs exactly as in indicators.json.
 *  - `flagData(items, indicatorsJson)` is the primary entrypoint (no indicatorMap).
 *  - Indicators metadata is retrieved via getIndicatorMetadata(json, id).
 */

/**
 * Get a metadata map for the indicator IDs present in the data rows.
 * Expects exact-id matching (no normalization).
 *
 * @param {string[]} indicatorCodes - indicator IDs (exact)
 * @param {Object} indicatorsJson - full indicators.json parsed object
 * @returns {{ [id: string]: any }}
 */
export function extractIndicatorMetadata(indicatorCodes, indicatorsJson) {
	const out = {};
	if (!Array.isArray(indicatorCodes) || !indicatorsJson) return out;

	for (const id of indicatorCodes) {
		if (typeof id !== 'string') continue;
		const md = getIndicatorMetadata(indicatorsJson, id);
		if (md) out[id] = md;
	}
	return out;
}

/**
 * Flag rows based on AN thresholds.
 * Breaking signature: no indicatorMap; indicator column names must match canonical IDs.
 *
 * @param {Array<Record<string, number|null>>} items
 * @param {Object} indicatorsJson
 * @returns {Array<Record<string, any>>}
 */
export function flagData(items, indicatorsJson) {
	if (!Array.isArray(items) || items.length === 0) return [];
	if (!indicatorsJson) throw new Error('indicatorsJson is required; pass parsed indicators.json');

	// Column keys of the data rows, excluding 'uoa' exactly
	const first = items[0];
	const dataKeys = Object.keys(first).filter((k) => String(k) !== 'uoa');

	// Build metadata lookup for only the indicator IDs present in data
	const metadata = extractIndicatorMetadata(dataKeys, indicatorsJson);

	// For quick membership tests (exact match)
	const dataKeySet = new Set(dataKeys);

	// Build mutate spec
	const mutateSpec = (() => {
		const indicatorEntries = dataKeys.flatMap((k) => {
			const def = metadata[k]; // metadata for canonical ID k, or undefined
			const flagKey = `${k}_flag`;
			const flagLabel = `${k}_flag_label`;
			const within10percKey = `${k}_within_10perc`;
			const within10percChangeKey = `${k}_within_10perc_change`;

			return [
				[
					flagKey,
					(d) => {
						// If no metadata, treat as no data (null)
						if (!def || !def.raw) return null;

						const value = d[k];
						if (value === null || value === undefined) return null;
						if (typeof value !== 'number') return null;

						const anThreshold = def.raw.thresholds && def.raw.thresholds.an;
						const direction = def.raw.above_or_below;

						if (anThreshold === undefined || direction === undefined) return null;

						if (direction === 'Above') return value >= anThreshold;
						if (direction === 'Below') return value <= anThreshold;

						return null;
					}
				],
				[
					flagLabel,
					(d) => {
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
						if (!def || !def.raw) return null;
						const value = d[k];
						if (value === null || value === undefined) return null;
						if (typeof value !== 'number') return null;

						const anThreshold = def.raw.thresholds && def.raw.thresholds.an;
						if (anThreshold === undefined || anThreshold === null) return null;

						if (anThreshold === 0) return value === 0;
						const percentDistance = Math.abs((value - anThreshold) / anThreshold);
						return percentDistance <= 0.1;
					}
				],
				[
					within10percChangeKey,
					(d) => {
						if (!def || !def.raw) return null;
						const value = d[k];
						if (value === null || value === undefined) return null;
						if (typeof value !== 'number') return null;

						const anThreshold = def.raw.thresholds && def.raw.thresholds.an;
						const direction = def.raw.above_or_below;
						if (anThreshold === undefined || direction === undefined || anThreshold === 0)
							return null;

						const percentDistance = Math.abs((value - anThreshold) / anThreshold);
						const thresholdMet =
							direction === 'Above' ? value >= anThreshold : value <= anThreshold;
						return percentDistance <= 0.1 && !thresholdMet;
					}
				]
			];
		});

		// Build subfactor aggregation entries using buildSubfactorList
		const subfactorEntries = [];
		const subList = buildSubfactorList(indicatorsJson);

		for (const { path, codes } of subList) {
			// Only keep codes that appear as columns in the data (exact match)
			const actualKeys = codes.filter((c) => dataKeySet.has(c));
			if (actualKeys.length === 0) continue;

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

	return tidy(items, mutate(mutateSpec));
}

/**
 * Generate downloadable JSON from flagged data
 * @param {Object[]} flaggedData
 * @param {string} filename
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
 * Generate downloadable CSV from flagged data
 * @param {Object[]} flaggedData
 * @param {string} filename
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
 * @param {Object[]} flaggedData
 * @param {string} filename
 */
export async function downloadXLSX(flaggedData, filename = 'data.xlsx') {
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet('Flagged Data');

	if (!Array.isArray(flaggedData) || flaggedData.length === 0) {
		worksheet.addRow(['No data']);
	} else {
		const headers = Object.keys(flaggedData[0]);
		worksheet.columns = headers.map((h) => ({
			header: h,
			key: h,
			width: Math.max(10, String(h).length + 2)
		}));

		for (const row of flaggedData) {
			const rowValues = headers.map((h) => {
				const v = row[h];
				if (v === null || v === undefined) return null;
				if (typeof v === 'object') return JSON.stringify(v);
				return v;
			});
			worksheet.addRow(rowValues);
		}

		worksheet.views = [{ state: 'frozen', ySplit: 1 }];
	}

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
		console.error('XLSX generation failed, falling back to CSV:', err);
		downloadCSV(flaggedData, filename.replace(/\.xlsx?$/i, '.csv'));
	}
}
