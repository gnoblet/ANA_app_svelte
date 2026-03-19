#!/usr/bin/env bun
/**
 * generate-indicators-json.ts
 * Converts static/data/ANA_2025_reference.csv → static/data/indicators.json
 * Run validate-indicators.ts afterwards to check schema + id consistency.
 *
 * Usage:
 *   bun ./scripts/generate-indicators-json.ts [--csv <path>] [--out <path>] [--help]
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import type { Indicator, IndicatorsRoot } from '../src/lib/types/structure';

const DATA_DIR = path.join(process.cwd(), 'static', 'data');
const CSV_DEFAULT = path.join(DATA_DIR, 'ANA_2025_reference.csv');
const OUT_DEFAULT = path.join(DATA_DIR, 'indicators.json');

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { csvPath: string; outPath: string; help: boolean } {
	let csvPath = CSV_DEFAULT,
		outPath = OUT_DEFAULT,
		help = false;
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--help' || argv[i] === '-h') help = true;
		else if (argv[i] === '--csv' && argv[i + 1]) csvPath = path.resolve(argv[++i]);
		else if (argv[i] === '--out' && argv[i + 1]) outPath = path.resolve(argv[++i]);
	}
	return { csvPath, outPath, help };
}

// ── CSV row shape ─────────────────────────────────────────────────────────────

interface RefRow {
	Indicator_ID: string;
	Level: string;
	System: string;
	Factor: string;
	'Sub-Factor': string;
	Indicator: string;
	Preference: string;
	Type: string;
	Metric: string;
	'MSNA module': string;
	'MSNA indicator': string;
	'Question KOBO Code': string;
	'Remarks/Limitations': string;
	'Acute needs threshold (4) - Label': string;
	'Acute needs threshold (4)': string;
	'Very acute needs threshold (5) - Label': string;
	'Very acute needs threshold (5)': string;
	'Above or below': string;
	'Evidence threshold': string;
	'Factor threshold': string;
	'Risk concept': string;
	[key: string]: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const toSnakeCase = (s: string) =>
	s
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

const roundThreshold = (raw: string): number | null => {
	const s = raw.trim();
	if (s === '' || s.toUpperCase() === 'NA') return null;
	const n = parseFloat(s);
	return isNaN(n) ? null : Number(n.toPrecision(10));
};

const parseInteger = (raw: string): number => {
	const n = parseInt(raw.trim(), 10);
	return isNaN(n) ? 0 : n;
};
const nullIfEmpty = (s: string): string | null => {
	const t = s.trim();
	return t === '' ? null : t;
};
const nullIfNA = (s: string): string | null => {
	const t = s.trim();
	return t === '' || t.toUpperCase() === 'NA' ? null : t;
};

// ── CSV parsing ───────────────────────────────────────────────────────────────

function parseCsv<T>(filePath: string): T[] {
	if (!fs.existsSync(filePath)) {
		console.error(`Error: file not found: ${filePath}`);
		process.exit(2);
	}
	const raw = fs.readFileSync(filePath, 'utf-8');
	const result = Papa.parse<T>(raw.startsWith('\uFEFF') ? raw.slice(1) : raw, {
		header: true,
		skipEmptyLines: true
	});
	if (result.errors.length > 0) {
		console.warn(`Warnings parsing CSV (${result.errors.length}):`);
		result.errors
			.slice(0, 5)
			.forEach((e) => console.warn(`  row ${e.row ?? '?'}: [${e.code}] ${e.message}`));
	}
	return result.data.map((row) => {
		const out: Record<string, string> = {};
		for (const [k, v] of Object.entries(row as Record<string, string>))
			out[k.trim()] = (v ?? '').trim();
		return out as T;
	});
}

// ── Build ─────────────────────────────────────────────────────────────────────

type CircleNode = {
	name: string;
	children?: CircleNode[];
	value?: number;
	id?: string;
	/** Full indicator object for leaf nodes (matches `Indicator` from structure.ts) */
	indicator?: Indicator;
	/** Allow extra fields for consumers (e.g. thresholds, color, metadata). Use unknown to avoid permissive `any`. */
	[key: string]: unknown;
};

function build(rows: RefRow[]): {
	root: IndicatorsRoot;
	emptyTypeIds: string[];
	circlePackingRoot: CircleNode;
} {
	const systemOrder: string[] = [];
	const factorOrder = new Map<string, string[]>(); // sysId   → fKeys
	const sfOrder = new Map<string, string[]>(); // fKey    → sfKeys
	const indMap = new Map<string, Indicator[]>(); // sfKey   → indicators

	const systemLabels = new Map<string, string>();
	const factorLabels = new Map<string, string>();
	const sfLabels = new Map<string, string>();

	const seenSys = new Set<string>(),
		seenFac = new Set<string>(),
		seenSf = new Set<string>();
	const emptyTypeIds: string[] = [];

	const fk = (sys: string, fac: string) => `${sys}::${fac}`;
	const sfk = (sys: string, fac: string, sf: string) => `${sys}::${fac}::${sf}`;

	for (const row of rows) {
		const id = row['Indicator_ID']?.trim();
		if (!id?.startsWith('IND')) continue;

		const sysId = toSnakeCase(row['System'] ?? '');
		const facId = toSnakeCase(row['Factor'] ?? '');
		const sfId = toSnakeCase(row['Sub-Factor'] ?? '');
		const fKey = fk(sysId, facId);
		const sfKey = sfk(sysId, facId, sfId);

		if (!seenSys.has(sysId)) {
			seenSys.add(sysId);
			systemOrder.push(sysId);
			factorOrder.set(sysId, []);
			systemLabels.set(sysId, (row['System'] ?? '').trim());
		}
		if (!seenFac.has(fKey)) {
			seenFac.add(fKey);
			factorOrder.get(sysId)!.push(fKey);
			sfOrder.set(fKey, []);
			factorLabels.set(fKey, (row['Factor'] ?? '').trim());
		}
		if (!seenSf.has(sfKey)) {
			seenSf.add(sfKey);
			sfOrder.get(fKey)!.push(sfKey);
			indMap.set(sfKey, []);
			sfLabels.set(sfKey, (row['Sub-Factor'] ?? '').trim());
		}

		const rawType = (row['Type'] ?? '').trim();
		const type: string | null = rawType === '' ? null : rawType;
		if (type === null) emptyTypeIds.push(id);

		indMap.get(sfKey)!.push({
			indicator: id,
			level: nullIfEmpty(row['Level'] ?? ''),
			indicator_label: nullIfEmpty(row['Indicator'] ?? ''),
			preference: parseInteger(row['Preference'] ?? ''),
			type,
			metric: nullIfEmpty(row['Metric'] ?? ''),
			msna_module: nullIfEmpty(row['MSNA module'] ?? ''),
			msna_indicator: nullIfEmpty(row['MSNA indicator'] ?? ''),
			question_kobo_code: nullIfEmpty(row['Question KOBO Code'] ?? ''),
			remarks_limitations: nullIfEmpty(row['Remarks/Limitations'] ?? ''),
			thresholds: {
				an: roundThreshold(row['Acute needs threshold (4)'] ?? ''),
				an_label: nullIfEmpty(row['Acute needs threshold (4) - Label'] ?? ''),
				van: roundThreshold(row['Very acute needs threshold (5)'] ?? ''),
				van_label: nullIfEmpty(row['Very acute needs threshold (5) - Label'] ?? '')
			},
			above_or_below: (row['Above or below'] ?? '').trim(),
			evidence_threshold: parseInteger(row['Evidence threshold'] ?? ''),
			factor_threshold: parseInteger(row['Factor threshold'] ?? ''),
			risk_concept: nullIfNA(row['Risk concept'] ?? '')
		});
	}

	const root: IndicatorsRoot = {
		systems: systemOrder.map((sysId) => ({
			id: sysId,
			label: systemLabels.get(sysId) ?? sysId,
			factors: (factorOrder.get(sysId) ?? []).map((fKey) => {
				const [, facId] = fKey.split('::');
				return {
					id: facId,
					label: factorLabels.get(fKey) ?? facId,
					sub_factors: (sfOrder.get(fKey) ?? []).map((sfKey) => {
						const [, , sfId] = sfKey.split('::');
						return {
							id: sfId,
							label: sfLabels.get(sfKey) ?? sfId,
							indicators: indMap.get(sfKey) ?? []
						};
					})
				};
			})
		}))
	};

	// Build a D3 circle-packing friendly hierarchical object.
	// Leaves (indicators) receive a numeric `value` so D3 can size them.
	const circlePackingRoot = {
		name: 'flare',
		children: root.systems.map((sys) => ({
			name: sys.label ?? sys.id,
			children: sys.factors.map((fac) => ({
				name: fac.label ?? fac.id,
				children: fac.sub_factors.map((sf) => ({
					name: sf.label ?? sf.id,
					children: sf.indicators.map((ind) => ({
						name: ind.indicator_label ?? ind.indicator,
						id: ind.indicator,
						// Map `preference` to a reversed size so higher preference (1) => larger node.
						// preference: 1 -> size 3, 2 -> size 2, 3 -> size 1
						// Fallback to 1 if preference is missing/invalid.
						value: Math.max(1, 4 - (ind.preference ?? 3)),
						// Attach the full indicator object so the circle-packing leaf contains
						// all fields (level, type, metric, thresholds, etc.) for display/interaction.
						indicator: ind
					}))
				}))
			}))
		}))
	};

	return { root, emptyTypeIds, circlePackingRoot };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
	const { csvPath, outPath, help } = parseArgs(process.argv.slice(2));

	if (help) {
		console.log('Usage: bun ./scripts/generate-indicators-json.ts [--csv <path>] [--out <path>]');
		process.exitCode = 0;
		return;
	}

	console.log(`CSV: ${csvPath}`);
	const rows = parseCsv<RefRow>(csvPath);
	console.log(`Loaded: ${rows.length} row(s)`);

	const { root, emptyTypeIds, circlePackingRoot } = build(rows);

	if (emptyTypeIds.length > 0) {
		console.warn(
			`\n⚠ ${emptyTypeIds.length} indicator(s) have empty Type → type: null (not validated):`
		);
		for (let i = 0; i < emptyTypeIds.length; i += 6)
			console.warn('  ' + emptyTypeIds.slice(i, i + 6).join(', '));
	}

	const allIds = root.systems.flatMap((s) =>
		s.factors.flatMap((f) => f.sub_factors.flatMap((sf) => sf.indicators.map((i) => i.indicator)))
	);
	const dupes = [...new Set(allIds.filter((id, i) => allIds.indexOf(id) !== i))];
	if (dupes.length > 0) console.warn(`\n⚠ Duplicate indicator IDs: ${dupes.join(', ')}`);

	console.log('\nStructure:');
	let total = 0;
	for (const sys of root.systems) {
		const nInd = sys.factors.reduce(
			(n, f) => n + f.sub_factors.reduce((m, sf) => m + sf.indicators.length, 0),
			0
		);
		total += nInd;
		console.log(
			`  ${sys.id.padEnd(32)} ${String(nInd).padStart(3)} ind  (${sys.factors.length} factors, ${sys.factors.reduce((n, f) => n + f.sub_factors.length, 0)} sub-factors)`
		);
	}
	console.log(`  ${'TOTAL'.padEnd(32)} ${String(total).padStart(3)}`);
	if (emptyTypeIds.length > 0) console.log(`  Null type: ${emptyTypeIds.length}`);

	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	const json = JSON.stringify(root, null, 2);
	fs.writeFileSync(outPath, json, 'utf-8');
	console.log(`\nWrote: ${outPath} (${(json.length / 1024).toFixed(1)} KB)`);

	// Also write a D3 circle-packing friendly JSON alongside `indicators.json`.
	const cpOutPath = path.join(path.dirname(outPath), 'indicators-circlepacking.json');
	const cpJson = JSON.stringify(circlePackingRoot, null, 2);
	fs.writeFileSync(cpOutPath, cpJson, 'utf-8');
	console.log(`Wrote: ${cpOutPath} (${(cpJson.length / 1024).toFixed(1)} KB)`);

	process.exitCode = 0;
}

main();
