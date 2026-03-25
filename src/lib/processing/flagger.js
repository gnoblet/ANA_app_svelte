import { tidy, mutate, leftJoin } from '@tidyjs/tidy';
import Papa from 'papaparse';import ExcelJS from '@protobi/exceljs';
import {
	buildSubfactorList,
	getIndicatorMetadata,
	getAllIndicatorIds
} from '../access/access_indicators.js';

/**
 * Lightweight, modular flagger
 *
 * - Entry: flagData(items, indicatorsJson)
 * - Assumes validator has ensured `uoa` exists on every row and indicator column
 *   names are the canonical IDs used in indicatorsJson.
 *
 * Implementation notes:
 * - Missing canonical indicator columns are added via a left-join (one join row
 *   per input row with null placeholders).
 * - Per-indicator flags and within-10% computations are generated via helper.
 * - Group-level counts are generated via a reusable group helper and applied to
 *   subfactor, factor and system levels.
 */

/* --------------------- Helpers --------------------- */

const isNumber = (v) => typeof v === 'number' && !Number.isNaN(v);

/**
 * Create mutate entries for a single indicator id.
 * Produces: {id}_flag, {id}_flag_label, {id}_within_10perc, {id}_within_10perc_change
 *
 * @param {string} id
 * @param {object|null} md - metadata returned from getIndicatorMetadata
 * @returns {Array<[string, Function]>}
 */
function makeIndicatorEntries(id, md) {
	const flagKey = `${id}_flag`;
	const labelKey = `${id}_flag_label`;
	const withinKey = `${id}_within_10perc`;
	const withinChangeKey = `${id}_within_10perc_change`;

	return [
		[
			flagKey,
			(d) => {
				if (!md || !md.raw) return null;
				const v = d[id];
				if (v === null || v === undefined) return null;
				if (!isNumber(v)) return null;

				const th = md.raw.thresholds && md.raw.thresholds.an;
				const dir = md.raw.above_or_below;
				if (th === undefined || dir === undefined) return null;

				return dir === 'Above' ? v >= th : v <= th;
			}
		],
		[
			labelKey,
			(d) => {
				const f = d[flagKey];
				if (f === null || f === undefined) return 'no_data';
				return f ? 'flag' : 'noflag';
			}
		],
		[
			withinKey,
			(d) => {
				if (!md || !md.raw) return null;
				const v = d[id];
				if (!isNumber(v)) return null;
				const th = md.raw.thresholds && md.raw.thresholds.an;
				if (th === undefined || th === null) return null;
				if (th === 0) return v === 0;
				return Math.abs((v - th) / th) <= 0.1;
			}
		],
		[
			withinChangeKey,
			(d) => {
				if (!md || !md.raw) return null;
				const v = d[id];
				if (!isNumber(v)) return null;
				const th = md.raw.thresholds && md.raw.thresholds.an;
				const dir = md.raw.above_or_below;
				if (th === undefined || dir === undefined || th === 0) return null;
				const pct = Math.abs((v - th) / th);
				const met = dir === 'Above' ? v >= th : v <= th;
				return pct <= 0.1 && !met;
			}
		]
	];
}

/**
 * Make group-level count mutate entries for a set of indicator codes.
 * Returns entries for: `${prefix}.missing_n`, `${prefix}.flag_n`, `${prefix}.noflag_n`
 *
 * @param {string} prefix
 * @param {string[]} codes
 * @returns {Array<[string, Function]>}
 */
function makeGroupCountEntries(prefix, codes) {
	return [
		[
			`${prefix}.missing_n`,
			(d) => codes.reduce((acc, c) => acc + (d[c] === null || d[c] === undefined ? 1 : 0), 0)
		],
		[
			`${prefix}.flag_n`,
			(d) => codes.reduce((acc, c) => acc + (d[`${c}_flag`] === true ? 1 : 0), 0)
		],
		[
			`${prefix}.noflag_n`,
			(d) => codes.reduce((acc, c) => acc + (d[`${c}_flag`] === false ? 1 : 0), 0)
		]
	];
}

/**
 * Build a metadata lookup for canonical indicator IDs.
 * @param {string[]} ids
 * @param {object} indicatorsJson
 * @returns {Record<string, any>}
 */
export function extractIndicatorMetadata(ids, indicatorsJson) {
	const out = {};
	if (!Array.isArray(ids) || !indicatorsJson) return out;
	for (const id of ids) {
		if (typeof id !== 'string') continue;
		const md = getIndicatorMetadata(indicatorsJson, id);
		if (md) out[id] = md;
	}
	return out;
}

/* --------------------- Main entry --------------------- */

/**
 * Flag data rows using indicators.json metadata.
 *
 * @param {Array<Record<string, any>>} items - input rows (each must include `uoa`)
 * @param {Object} indicatorsJson - parsed indicators.json
 * @returns {Array<Record<string, any>>}
 */
export function flagData(items, indicatorsJson) {
	// if items is not an array or is empty, return an empty array
	// if indicatorsJson is not provided, throw an error
	if (!Array.isArray(items) || items.length === 0) return [];
	if (!indicatorsJson) throw new Error('indicatorsJson is required');

	// join by 'uoa' key
	const joinBy = 'uoa';

	// canonical indicator ids (order preserved by getAllIndicatorIds)
	const canonicalIds = Array.isArray(getAllIndicatorIds(indicatorsJson))
		? getAllIndicatorIds(indicatorsJson)
		: [];

	// metadata lookup
	const metadata = extractIndicatorMetadata(canonicalIds, indicatorsJson);

	// build join array: one object per input row with uoa and nulls for missing canonical cols
	const joinArray = items.map((r) => {
		const obj = { [joinBy]: r[joinBy] };
		for (const id of canonicalIds) {
			if (!Object.prototype.hasOwnProperty.call(r, id)) obj[id] = null;
		}
		return obj;
	});

	// set of canonical indicator ids (used to filter codes for subfactors)
	const dataKeySet = new Set(canonicalIds);

	// indicator-level entries
	const indicatorEntries = canonicalIds.flatMap((id) => makeIndicatorEntries(id, metadata[id]));

	// subfactor -> gather codes, also build factor/system mappings
	const subList = buildSubfactorList(indicatorsJson) || [];
	const subEntries = [];
	const factorMap = new Map();
	const systemMap = new Map();

	// iterate over subfactors to gather codes and build factor/system mappings
	for (const { path, codes } of subList) {
		// filter codes to those present in the data
		const inData = (Array.isArray(codes) ? codes : []).filter((c) => dataKeySet.has(c));
		// if no codes are present, skip this subfactor
		if (inData.length === 0) continue;

		// subfactor counts
		subEntries.push(...makeGroupCountEntries(path, inData));

		// accumulate for factor/system
		const parts = String(path).split('.');
		const systemId = parts[0];
		const factorId = parts[1];
		if (!systemId || !factorId) continue;
		const factorKey = `${systemId}.${factorId}`;

		if (!factorMap.has(factorKey)) factorMap.set(factorKey, new Set());
		if (!systemMap.has(systemId)) systemMap.set(systemId, new Set());

		for (const c of inData) {
			factorMap.get(factorKey).add(c);
			systemMap.get(systemId).add(c);
		}
	}

	// build factor entries
	const factorEntries = [];
	for (const [factorKey, set] of factorMap.entries()) {
		const codes = Array.from(set);
		if (codes.length === 0) continue;
		factorEntries.push(...makeGroupCountEntries(factorKey, codes));
	}

	// build system entries
	const systemEntries = [];
	for (const [systemId, set] of systemMap.entries()) {
		const codes = Array.from(set);
		if (codes.length === 0) continue;
		systemEntries.push(...makeGroupCountEntries(systemId, codes));
	}

	// compose mutate spec (declaration order: indicators first so flags exist for group reducers)
	const mutateSpec = Object.fromEntries([
		...indicatorEntries,
		...subEntries,
		...factorEntries,
		...systemEntries
	]);

	// leftJoin placeholders then compute mutate spec
	return tidy(items, leftJoin(joinArray, { by: joinBy }), mutate(mutateSpec));
}

/* --------------------- Download helpers --------------------- */

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
