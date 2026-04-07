import { tidy, mutate } from '@tidyjs/tidy';
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
 * - Per-indicator flags and within-10% computations are generated via makeIndicatorSpec.
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
 * Build a mutate spec object for a single indicator id.
 * Produces four columns (mutate applies entries sequentially, so statusKey
 * can safely read the flagKey set by the preceding entry — mirrors dplyr behaviour):
 *   {id}_flag              — true | false | null
 *   {id}_status            — 'flag' | 'no_flag' | 'no_data'
 *   {id}_within_10perc     — boolean | null
 *   {id}_within_10perc_change — boolean | null
 *
 * @param {string} id
 * @param {object|null} md - metadata returned from getIndicatorMetadata
 * @returns {Record<string, Function>}
 */
function makeIndicatorSpec(id, md) {
	const flagKey = `${id}_flag`;
	const statusKey = `${id}_status`;
	const withinKey = `${id}_within_10perc`;
	const withinChangeKey = `${id}_within_10perc_change`;

	return {
		[flagKey]: (d) => {
			if (!md || !md.raw) return null;
			const v = d[id];
			if (v === null || v === undefined) return null;
			if (!isNumber(v)) return null;

			const th = md.raw.thresholds && md.raw.thresholds.an;
			const dir = md.raw.above_or_below;
			if (th === undefined || dir === undefined) return null;

			return dir === 'Above' ? v >= th : v <= th;
		},
		[statusKey]: (d) => {
			const f = d[flagKey];
			if (f === null || f === undefined) return 'no_data';
			return f ? 'flag' : 'no_flag';
		},
		[withinKey]: (d) => {
			if (!md || !md.raw) return null;
			const v = d[id];
			if (!isNumber(v)) return null;
			const th = md.raw.thresholds && md.raw.thresholds.an;
			if (th === undefined || th === null) return null;
			if (th === 0) return v === 0;
			return Math.abs((v - th) / th) <= 0.1;
		},
		[withinChangeKey]: (d) => {
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
	};
}

/**
 * Build a mutate spec object for group-level indicator counts.
 * Retained for the heatmap visualisation.
 * Returns columns: `${prefix}.missing_n`, `${prefix}.flag_n`, `${prefix}.no_flag_n`
 *
 * @param {string} prefix
 * @param {string[]} codes
 * @returns {Record<string, Function>}
 */
function makeCountSpec(prefix, codes) {
	return {
		[`${prefix}.missing_n`]: (d) =>
			codes.reduce((acc, c) => acc + (d[c] === null || d[c] === undefined ? 1 : 0), 0),
		[`${prefix}.flag_n`]: (d) =>
			codes.reduce((acc, c) => acc + (d[`${c}_flag`] === true ? 1 : 0), 0),
		[`${prefix}.no_flag_n`]: (d) =>
			codes.reduce((acc, c) => acc + (d[`${c}_flag`] === false ? 1 : 0), 0)
	};
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

	// ── Setup ─────────────────────────────────────────────────────────────────

	// canonical indicator ids (order preserved by getAllIndicatorIds)
	const canonicalIds = getAllIndicatorIds(indicatorsJson);

	// metadata lookup: id → { raw, systemId, factorId, subfactorId, ... }
	const metadata = extractIndicatorMetadata(canonicalIds, indicatorsJson);

	// pad each row with explicit null for any canonical indicator column not present in input
	const padded = items.map((r) => {
		const out = { ...r };
		for (const id of canonicalIds) {
			if (!(id in out)) out[id] = null;
		}
		return out;
	});

	// ── Layer 1: indicator-level spec ─────────────────────────────────────────
	// One spec object per indicator merged into one flat object.
	// Within a single mutate() call, entries are applied sequentially (each entry
	// receives the already-mutated row), so {id}_status can safely read {id}_flag.
	const indicatorSpec = Object.assign(
		{},
		...canonicalIds.map((id) => makeIndicatorSpec(id, metadata[id]))
	);

	// ── Layer 2: subfactor-level spec ─────────────────────────────────────────

	const dataKeySet = new Set(canonicalIds);
	const subList = buildSubfactorList(indicatorsJson) || [];

	// Hierarchy lookup built while iterating subfactors, reused for layers 3 & 4.
	// factorCodes[factorKey]     → string[]  (all indicator codes under that factor)
	// factorSfPaths[factorKey]   → string[]  (subfactor paths under that factor)
	// systemCodes[systemId]      → string[]  (all indicator codes under that system)
	// systemFactorKeys[systemId] → string[]  (factor keys under that system)
	/** @type {Record<string, string[]>} */ const factorCodes = {};
	/** @type {Record<string, string[]>} */ const factorSfPaths = {};
	/** @type {Record<string, string[]>} */ const systemCodes = {};
	/** @type {Record<string, string[]>} */ const systemFactorKeys = {};

	/** @type {Record<string, any>} */ const subfactorSpec = {};

	for (const { path, codes, groups } of subList) {
		// restrict to indicators present in the canonical data
		const inData = codes.filter((c) => dataKeySet.has(c));
		if (inData.length === 0) continue;

		// filter threshold groups to codes present in the data
		const inDataGroups = groups
			.map((g) => ({ ...g, codes: g.codes.filter((c) => dataKeySet.has(c)) }))
			.filter((g) => g.codes.length > 0);

		// backward-compat counts + threshold-aware status
		Object.assign(subfactorSpec, makeCountSpec(path, inData));
		subfactorSpec[`${path}.status`] = (d) => {
			if (inDataGroups.length === 0) return 'no_data';
			const groupStatuses = inDataGroups.map((g) => evaluateGroup(g, d));
			if (groupStatuses.some((s) => s === 'flag')) return 'flag';
			if (groupStatuses.some((s) => s === 'no_flag')) return 'no_flag';
			if (groupStatuses.some((s) => s === 'insufficient_evidence')) return 'insufficient_evidence';
			return 'no_data';
		};

		// accumulate paths for layers 3 & 4
		const [systemId, factorId] = path.split('.');
		if (!systemId || !factorId) continue;
		const factorKey = `${systemId}.${factorId}`;

		(factorCodes[factorKey] ??= []).push(...inData);
		(factorSfPaths[factorKey] ??= []).push(path);
		(systemCodes[systemId] ??= []).push(...inData);
		(systemFactorKeys[systemId] ??= []).push(factorKey);
	}

	// ── Layer 3: factor-level spec ────────────────────────────────────────────
	// Status is a rollup of the subfactor statuses written in Layer 2.
	/** @type {Record<string, any>} */ const factorSpec = {};
	for (const [factorKey, sfPaths] of Object.entries(factorSfPaths)) {
		Object.assign(factorSpec, makeCountSpec(factorKey, factorCodes[factorKey]));
		factorSpec[`${factorKey}.status`] = (d) =>
			rollupStatuses(sfPaths.map((p) => d[`${p}.status`] ?? 'no_data'));
	}

	// ── Layer 4: system-level spec ────────────────────────────────────────────
	// Status is a rollup of the factor statuses written in Layer 3.
	/** @type {Record<string, any>} */ const systemSpec = {};
	for (const [systemId, fKeys] of Object.entries(systemFactorKeys)) {
		Object.assign(systemSpec, makeCountSpec(systemId, systemCodes[systemId]));
		systemSpec[`${systemId}.status`] = (d) =>
			rollupStatuses(fKeys.map((k) => d[`${k}.status`] ?? 'no_data'));
	}

	// ── Layer 5: ANA preliminary flag classification ──────────────────────────
	const allSystemIds = Object.keys(systemFactorKeys);
	const knownSystems = new Set(
		/** @type {any} */ (indicatorsJson).systems?.map((/** @type {any} */ s) => s.id) ?? []
	);
	const mortalitySystemId = knownSystems.has('mortality') ? 'mortality' : null;
	const healthOutcomesId = knownSystems.has('health_outcomes') ? 'health_outcomes' : null;
	const marketId = knownSystems.has('market_functionality') ? 'market_functionality' : null;

	// market_functionality does not enter the classification
	const activeSystems = allSystemIds.filter((s) => s !== marketId);

	const prelimFlagFn = (d) => {
		const status = (key) => (key ? (d[`${key}.status`] ?? 'no_data') : 'no_data');
		const isFlagged = (key) => status(key) === 'flag';
		const isInsuff = (key) => status(key) === 'insufficient_evidence';

		// 1. Emergency — mortality system flagged
		if (isFlagged(mortalitySystemId)) return 'EM';

		// 2. Risk of Emergency — health outcomes flagged AND ≥3 other active systems flagged
		const otherFlagged = activeSystems.filter((s) => s !== healthOutcomesId && isFlagged(s)).length;
		if (isFlagged(healthOutcomesId) && otherFlagged >= 3) return 'ROEM';

		// 3. Acute Needs — any active system flagged
		if (activeSystems.some(isFlagged)) return 'ACUTE';

		// 4. Insufficient Evidence — no flag, but at least one system has insufficient evidence
		if (activeSystems.some(isInsuff)) return 'INSUFFICIENT_EVIDENCE';

		// 5. No Data — no flag, no insufficient evidence, all systems are no_data
		if (activeSystems.every((s) => status(s) === 'no_data')) return 'NO_DATA';

		// 6. No Acute Needs — all active systems are no_flag
		return 'NO_ACUTE_NEEDS';
	};

	// ── Pipeline ──────────────────────────────────────────────────────────────
	// Five sequential mutate() steps, one per logical layer — mirrors dplyr's
	// pipe: padded |> mutate(...) |> mutate(...) |> ...
	return tidy(
		padded,
		mutate(indicatorSpec), // Layer 1: per-indicator _flag, _status, _within_10perc
		mutate(subfactorSpec), // Layer 2: subfactor counts + threshold-aware status
		mutate(factorSpec), // Layer 3: factor counts + rollup status
		mutate(systemSpec), // Layer 4: system counts + rollup status
		mutate({ prelim_flag: prelimFlagFn }) // Layer 5: ANA classification
	);
}
