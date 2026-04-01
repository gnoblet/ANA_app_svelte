import { tidy, mutate } from '@tidyjs/tidy';
import Papa from 'papaparse';
import ExcelJS from '@protobi/exceljs';
import {
	buildSubfactorList,
	getIndicatorMetadata,
	getAllIndicatorIds
} from './access_indicators.js';

/**
 * Lightweight, modular flagger
 *
 * - Entry: flagData(items, indicatorsJson)
 * - Assumes validator has ensured `uoa` exists on every row and indicator column
 *   names are the canonical IDs used in indicatorsJson.
 *
 * Implementation notes:
 * - Missing canonical indicator columns are null-padded onto each input row before
 *   the mutate pass, so output rows always carry explicit nulls for every canonical id.
 * - Per-indicator flags and within-10% computations are generated via makeIndicatorEntries.
 * - Subfactor status is evaluated using threshold groups from buildSubfactorList:
 *   indicators sharing the same (factor_threshold, evidence_threshold) pair are
 *   pooled and evaluated together. A subfactor flags if any group reaches its
 *   factor_threshold; it concludes no_flag if any group reaches its evidence_threshold.
 * - Factor and system statuses are rolled up from their children's statuses via
 *   rollupStatuses.
 * - prelim_flag is derived from system statuses using the ANA decision tree.
 *
 * Status vocabulary (used at all levels from indicator to system):
 *   'flag'                 — threshold crossed / acute needs detected
 *   'no_flag'              — enough evidence to conclude no acute needs
 *   'insufficient_evidence'— some data present but not enough to conclude
 *   'no_data'              — no data at all for this level
 */

/* --------------------- Helpers --------------------- */

const isNumber = (v) => typeof v === 'number' && !Number.isNaN(v);

/**
 * Evaluate a single threshold group against the current row.
 * A group is a set of indicators sharing the same (factor_threshold, evidence_threshold).
 *
 * @param {{ factor_threshold: number, evidence_threshold: number, codes: string[] }} group
 * @param {Record<string, any>} d - current row (flags already computed)
 * @returns {'flag' | 'no_flag' | 'insufficient_evidence' | 'no_data'}
 */
function evaluateGroup(group, d) {
	let flag_n = 0;
	let no_flag_n = 0;
	for (const c of group.codes) {
		const f = d[`${c}_flag`];
		if (f === true) flag_n++;
		else if (f === false) no_flag_n++;
	}
	const data_n = flag_n + no_flag_n;
	if (flag_n >= group.factor_threshold) return 'flag';
	if (data_n >= group.evidence_threshold) return 'no_flag';
	if (data_n === 0) return 'no_data';
	return 'insufficient_evidence';
}

/**
 * Roll up an array of status strings into a single status.
 * Used for factor ← subfactor and system ← factor rollups.
 *
 * Priority:
 *   flag > no_flag > insufficient_evidence > no_data
 *
 * Special case: if all children are no_data, return no_data rather than
 * insufficient_evidence, to distinguish "nothing collected" from "some data
 * but not enough to conclude".
 *
 * @param {string[]} statuses
 * @returns {'flag' | 'no_flag' | 'insufficient_evidence' | 'no_data'}
 */
function rollupStatuses(statuses) {
	if (statuses.length === 0) return 'no_data';
	if (statuses.some((s) => s === 'flag')) return 'flag';
	if (statuses.every((s) => s === 'no_flag')) return 'no_flag';
	if (statuses.every((s) => s === 'no_data')) return 'no_data';
	return 'insufficient_evidence';
}

/**
 * Create mutate entries for a single indicator id.
 * Produces:
 *   {id}_flag              — true | false | null
 *   {id}_status            — 'flag' | 'no_flag' | 'no_data'
 *   {id}_within_10perc     — boolean | null
 *   {id}_within_10perc_change — boolean | null
 *
 * @param {string} id
 * @param {object|null} md - metadata returned from getIndicatorMetadata
 * @returns {Array<[string, Function]>}
 */
function makeIndicatorEntries(id, md) {
	const flagKey = `${id}_flag`;
	const statusKey = `${id}_status`;
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
			statusKey,
			(d) => {
				const f = d[flagKey];
				if (f === null || f === undefined) return 'no_data';
				return f ? 'flag' : 'no_flag';
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
 * Retained for backward compatibility with the heatmap visualisation.
 * Returns entries for: `${prefix}.missing_n`, `${prefix}.flag_n`, `${prefix}.no_flag_n`
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
			`${prefix}.no_flag_n`,
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
function extractIndicatorMetadata(ids, indicatorsJson) {
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
	if (!Array.isArray(items) || items.length === 0) return [];
	if (!indicatorsJson) throw new Error('indicatorsJson is required');

	// canonical indicator ids (order preserved by getAllIndicatorIds)
	const canonicalIds = getAllIndicatorIds(indicatorsJson);

	// metadata lookup
	const metadata = extractIndicatorMetadata(canonicalIds, indicatorsJson);

	// pad each row with explicit null for any canonical indicator column not present in input
	const padded = items.map((r) => {
		const out = { ...r };
		for (const id of canonicalIds) {
			if (!(id in out)) out[id] = null;
		}
		return out;
	});

	// set of canonical indicator ids (used to filter codes for subfactors)
	const dataKeySet = new Set(canonicalIds);

	// indicator-level entries
	const indicatorEntries = canonicalIds.flatMap((id) => makeIndicatorEntries(id, metadata[id]));

	// subfactor list with threshold groups from access_indicators
	const subList = buildSubfactorList(indicatorsJson) || [];

	const subEntries = [];

	// Track subfactor paths per factor and factor paths per system for status rollup
	const factorMap = new Map();              // factorKey → Set<indicatorCode>
	const systemMap = new Map();             // systemId  → Set<indicatorCode>
	const factorSubfactorPaths = new Map();  // factorKey → Set<subfactorPath>
	const systemFactorPaths = new Map();     // systemId  → Set<factorPath>

	for (const { path, codes, groups } of subList) {
		// filter flat codes to those present in the canonical data
		const inData = (Array.isArray(codes) ? codes : []).filter((c) => dataKeySet.has(c));
		if (inData.length === 0) continue;

		// filter groups to only include codes present in the data
		const inDataSet = new Set(inData);
		const inDataGroups = (groups ?? [])
			.map((g) => ({ ...g, codes: g.codes.filter((c) => inDataSet.has(c)) }))
			.filter((g) => g.codes.length > 0);

		// ── subfactor: backward-compat count entries ──────────────────────────
		subEntries.push(...makeGroupCountEntries(path, inData));

		// ── subfactor: status entry (threshold-aware) ─────────────────────────
		subEntries.push([
			`${path}.status`,
			(d) => {
				if (inDataGroups.length === 0) return 'no_data';
				const groupStatuses = inDataGroups.map((g) => evaluateGroup(g, d));
				if (groupStatuses.some((s) => s === 'flag')) return 'flag';
				if (groupStatuses.some((s) => s === 'no_flag')) return 'no_flag';
				if (groupStatuses.some((s) => s === 'insufficient_evidence'))
					return 'insufficient_evidence';
				return 'no_data';
			}
		]);

		// accumulate for factor/system
		const parts = String(path).split('.');
		const systemId = parts[0];
		const factorId = parts[1];
		if (!systemId || !factorId) continue;
		const factorKey = `${systemId}.${factorId}`;

		if (!factorMap.has(factorKey)) factorMap.set(factorKey, new Set());
		if (!systemMap.has(systemId)) systemMap.set(systemId, new Set());
		if (!factorSubfactorPaths.has(factorKey)) factorSubfactorPaths.set(factorKey, new Set());
		if (!systemFactorPaths.has(systemId)) systemFactorPaths.set(systemId, new Set());

		for (const c of inData) {
			factorMap.get(factorKey).add(c);
			systemMap.get(systemId).add(c);
		}
		factorSubfactorPaths.get(factorKey).add(path);
		systemFactorPaths.get(systemId).add(factorKey);
	}

	// ── factor entries ────────────────────────────────────────────────────────
	const factorEntries = [];
	for (const [factorKey, set] of factorMap.entries()) {
		const codes = Array.from(set);
		if (codes.length === 0) continue;

		// backward-compat counts
		factorEntries.push(...makeGroupCountEntries(factorKey, codes));

		// status: rollup of subfactor statuses
		const sfPaths = Array.from(factorSubfactorPaths.get(factorKey) ?? []);
		factorEntries.push([
			`${factorKey}.status`,
			(d) => {
				const sfStatuses = sfPaths.map((p) => d[`${p}.status`] ?? 'no_data');
				return rollupStatuses(sfStatuses);
			}
		]);
	}

	// ── system entries ────────────────────────────────────────────────────────
	const systemEntries = [];
	for (const [systemId, set] of systemMap.entries()) {
		const codes = Array.from(set);
		if (codes.length === 0) continue;

		// backward-compat counts
		systemEntries.push(...makeGroupCountEntries(systemId, codes));

		// status: rollup of factor statuses
		const fPaths = Array.from(systemFactorPaths.get(systemId) ?? []);
		systemEntries.push([
			`${systemId}.status`,
			(d) => {
				const fStatuses = fPaths.map((p) => d[`${p}.status`] ?? 'no_data');
				return rollupStatuses(fStatuses);
			}
		]);
	}

	// ── prelim_flag decision tree ─────────────────────────────────────────────
	const allSystemIds = Array.from(systemMap.keys());
	const knownSystems = new Set((indicatorsJson.systems?.map((s) => /** @type {any} */ (s).id) ?? []));
	const mortalitySystemId = knownSystems.has('mortality') ? 'mortality' : null;
	const healthOutcomesId = knownSystems.has('health_outcomes') ? 'health_outcomes' : null;
	const marketId = knownSystems.has('market_functionality') ? 'market_functionality' : null;

	// market_functionality does not enter the classification
	const activeSystems = allSystemIds.filter((s) => s !== marketId);

	const prelimFlagEntry = [
		'prelim_flag',
		(d) => {
			const status = (key) => (key ? (d[`${key}.status`] ?? 'no_data') : 'no_data');
			const isFlagged = (key) => status(key) === 'flag';
			const isInsuff = (key) => status(key) === 'insufficient_evidence';

			// 1. Emergency — mortality system flagged
			if (isFlagged(mortalitySystemId)) return 'EM';

			// 2. Risk of Emergency — health outcomes flagged AND ≥3 other active systems flagged
			const otherFlagged = activeSystems.filter(
				(s) => s !== healthOutcomesId && isFlagged(s)
			).length;
			if (isFlagged(healthOutcomesId) && otherFlagged >= 3) return 'ROEM';

			// 3. Acute Needs — any active system flagged
			if (activeSystems.some(isFlagged)) return 'ACUTE';

			// 4. Insufficient Evidence — no flag, but at least one system has insufficient evidence
			if (activeSystems.some(isInsuff)) return 'INSUFFICIENT_EVIDENCE';

			// 5. No Data — no flag, no insufficient evidence, all systems are no_data
			if (activeSystems.every((s) => status(s) === 'no_data')) return 'NO_DATA';

			// 6. No Acute Needs — all active systems are no_flag
			return 'NO_ACUTE_NEEDS';
		}
	];

	// compose mutate spec (declaration order matters: indicators first so flags
	// exist when subfactor/factor/system entries run)
	const mutateSpec = Object.fromEntries([
		...indicatorEntries,
		...subEntries,
		...factorEntries,
		...systemEntries,
		prelimFlagEntry
	]);

	return tidy(padded, mutate(mutateSpec));
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
