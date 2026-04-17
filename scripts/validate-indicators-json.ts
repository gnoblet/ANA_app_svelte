#!/usr/bin/env bun
/**
 * scripts/validate-indicators-json.ts
 *
 * Validates the generated `static/data/indicators.json` in two passes:
 *
 * Pass 1 — Zod schema
 *   Checks structural correctness of the JSON: indicator IDs, type syntax,
 *   threshold bounds, van-requires-an, above_or_below enum, etc.
 *
 * Pass 2 — Lookup CSV consistency
 *   Checks that every system, factor, and sub-factor id present in the JSON
 *   exists in the canonical lookup CSVs:
 *     static/data/system.csv      — valid system ids
 *     static/data/factor.csv      — valid (factor, system) pairs
 *     static/data/subfactor.csv   — valid (sub_factor, factor, system) triples
 *
 *   This is the authoritative place for these checks. The generator
 *   (generate-indicators-json.ts) only loads the lookup CSVs for label
 *   resolution and never aborts on mismatch.
 *
 * Usage:
 *   bun ./scripts/validate-indicators.ts
 *   bun ./scripts/validate-indicators.ts --json static/data/indicators.json
 *   bun ./scripts/validate-indicators.ts --factor static/data/factor.csv
 *   bun ./scripts/validate-indicators.ts --subfactor static/data/subfactor.csv
 *   bun ./scripts/validate-indicators.ts --help
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more validation errors
 *   2 — I/O or parse error (file not found, invalid JSON/CSV)
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { safeValidateIndicatorsRoot, formatZodErrors } from '$lib/types/indicators-json';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'static', 'data');

const DEFAULTS = {
	json: path.join(DATA_DIR, 'indicators.json'),
	factor: path.join(DATA_DIR, 'factor.csv'),
	subfactor: path.join(DATA_DIR, 'subfactor.csv')
};

// ── CLI ───────────────────────────────────────────────────────────────────────

interface Args {
	jsonPath: string;
	factorPath: string;
	subfactorPath: string;
	help: boolean;
}

function parseArgs(argv: string[]): Args {
	let jsonPath = DEFAULTS.json;
	let factorPath = DEFAULTS.factor;
	let subfactorPath = DEFAULTS.subfactor;
	let help = false;

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--help' || arg === '-h') {
			help = true;
		} else if (arg === '--json' && argv[i + 1]) {
			jsonPath = path.resolve(argv[++i]);
		} else if (arg === '--factor' && argv[i + 1]) {
			factorPath = path.resolve(argv[++i]);
		} else if (arg === '--subfactor' && argv[i + 1]) {
			subfactorPath = path.resolve(argv[++i]);
		}
	}

	return { jsonPath, factorPath, subfactorPath, help };
}

function printHelp(): void {
	console.log(`
validate-indicators.ts — Validate indicators.json against Zod schema and lookup CSVs

Usage:
  bun ./scripts/validate-indicators.ts [flags]

Flags:
  --json      <path>   indicators JSON to validate
                       (default: static/data/indicators.json)
  --factor    <path>   Factor lookup CSV    (default: static/data/factor.csv)
  --subfactor <path>   Sub-factor lookup CSV (default: static/data/subfactor.csv)
  --help, -h           Print this help and exit

Checks performed:

  Pass 1 — Zod schema
    · metric IDs match MET followed by 3+ digits (e.g. MET001)
    · type matches the type-syntax regex, or is null
    · threshold bounds match the declared type (num/int, lb, ub)
    · van cannot be set without an
    · above_or_below is "Above" or "Below"
    · preference is 1, 2, or 3

  Pass 2 — Lookup CSV consistency
    · every (factor, system) pair exists in factor.csv
    · every (sub_factor, factor, system) triple exists in subfactor.csv
    Note: system ids are already enforced by Pass 1 via z.enum(SystemIDEnum).
`);
}

// ── Lookup CSV row shapes ─────────────────────────────────────────────────────

interface FactorRow {
	factor: string;
	factor_label: string;
	system: string;
}
interface SubfactorRow {
	sub_factor: string;
	sub_factor_label: string;
	factor: string;
	system: string;
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

function parseCsv<T>(filePath: string, label: string): T[] | null {
	if (!fs.existsSync(filePath)) {
		console.error(`Error: ${label} not found: ${filePath}`);
		return null;
	}

	const raw = fs.readFileSync(filePath, 'utf-8');
	const content = raw.startsWith('\uFEFF') ? raw.slice(1) : raw; // strip BOM

	const result = Papa.parse<T>(content, { header: true, skipEmptyLines: true });

	if (result.errors.length > 0) {
		console.warn(`Warnings parsing ${label} (${result.errors.length}):`);
		for (const e of result.errors.slice(0, 5)) {
			console.warn(`  row ${e.row ?? '?'}: [${e.code}] ${e.message}`);
		}
	}

	return result.data.map((row) => {
		const trimmed: Record<string, string> = {};
		for (const [k, v] of Object.entries(row as Record<string, string>)) {
			trimmed[k.trim()] = (v ?? '').trim();
		}
		return trimmed as T;
	});
}

// ── Lookup CSV consistency check ──────────────────────────────────────────────

interface LookupError {
	/** Human-readable JSON path, e.g. "systems[2].factors[0].sub_factors[1]" */
	location: string;
	kind: 'factor' | 'subfactor';
	/** The id that was not found in the lookup CSV. */
	id: string;
	/** The composite key that was checked (for factor/subfactor). */
	key: string;
}

function checkLookupConsistency(
	data: unknown,
	factorRows: FactorRow[],
	subfactorRows: SubfactorRow[]
): LookupError[] {
	const validFactors = new Set(factorRows.map((r) => `${r.factor}::${r.system}`));
	const validSubfactors = new Set(
		subfactorRows.map((r) => `${r.sub_factor}::${r.factor}::${r.system}`)
	);

	const errors: LookupError[] = [];

	// Cast loosely — Zod pass already confirmed shape when it succeeded.
	const root = data as {
		systems?: Array<{
			id?: string;
			factors?: Array<{
				id?: string;
				sub_factors?: Array<{
					id?: string;
					indicators?: Array<{ id?: string }>;
				}>;
			}>;
		}>;
	};

	for (let si = 0; si < (root.systems?.length ?? 0); si++) {
		const sys = root.systems![si];
		const sysId = sys.id ?? '';
		const sysLoc = `systems[${si}]`;

		for (let fi = 0; fi < (sys.factors?.length ?? 0); fi++) {
			const fac = sys.factors![fi];
			const facId = fac.id ?? '';
			const facKey = `${facId}::${sysId}`;
			const facLoc = `${sysLoc}.factors[${fi}]`;

			if (!validFactors.has(facKey)) {
				errors.push({ location: facLoc, kind: 'factor', id: facId, key: facKey });
			}

			for (let sfi = 0; sfi < (fac.sub_factors?.length ?? 0); sfi++) {
				const sf = fac.sub_factors![sfi];
				const sfId = sf.id ?? '';
				const sfKey = `${sfId}::${facId}::${sysId}`;
				const sfLoc = `${facLoc}.sub_factors[${sfi}]`;

				if (!validSubfactors.has(sfKey)) {
					errors.push({ location: sfLoc, kind: 'subfactor', id: sfId, key: sfKey });
				}
			}
		}
	}

	return errors;
}

function printLookupErrors(errors: LookupError[]): void {
	const byFactors = errors.filter((e) => e.kind === 'factor');
	const bySubfactors = errors.filter((e) => e.kind === 'subfactor');

	console.error('\n❌ Pass 2 failed — the JSON contains ids not present in the lookup CSVs.');
	console.error('   Regenerate indicators.json or update the lookup CSVs so the ids match.\n');

	if (byFactors.length > 0) {
		console.error(`── Unknown factors (${byFactors.length}) ──────────────────────────────────`);
		for (const e of byFactors) {
			const [facId, sysId] = e.key.split('::');
			console.error(
				`  ${e.location}: factor "${facId}" under system "${sysId}" not found in factor.csv`
			);
		}
		console.error('');
	}

	if (bySubfactors.length > 0) {
		console.error(`── Unknown sub-factors (${bySubfactors.length}) ────────────────────────────`);
		for (const e of bySubfactors) {
			const [sfId, facId, sysId] = e.key.split('::');
			console.error(
				`  ${e.location}: sub_factor "${sfId}" under factor "${facId}" / system "${sysId}" not found in subfactor.csv`
			);
		}
		console.error('');
	}

	console.error(`Total: ${errors.length} unknown id(s).`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));

	if (args.help) {
		printHelp();
		process.exitCode = 0;
		return;
	}

	const { jsonPath, factorPath, subfactorPath } = args;

	// ── Load JSON ──────────────────────────────────────────────────────────────
	if (!fs.existsSync(jsonPath)) {
		console.error(`File not found: ${jsonPath}`);
		process.exitCode = 2;
		return;
	}

	let raw: string;
	try {
		raw = fs.readFileSync(jsonPath, 'utf-8');
	} catch (err) {
		console.error('Failed to read file:', err);
		process.exitCode = 2;
		return;
	}

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (err) {
		console.error('Failed to parse JSON:', err);
		process.exitCode = 2;
		return;
	}

	// ── Load lookup CSVs ───────────────────────────────────────────────────────
	const factorRows = parseCsv<FactorRow>(factorPath, 'factor CSV');
	const subfactorRows = parseCsv<SubfactorRow>(subfactorPath, 'subfactor CSV');

	if (!factorRows || !subfactorRows) {
		process.exitCode = 2;
		return;
	}

	let pass1Ok = false;
	let pass2Ok = false;

	// ── Pass 1: Zod schema ─────────────────────────────────────────────────────
	console.log('Pass 1 — Zod schema...');
	const zodResult = safeValidateIndicatorsRoot(data);

	if (zodResult.success) {
		console.log('  ✅ Passed');
		pass1Ok = true;
	} else {
		console.error('  ❌ Failed');
		try {
			const messages = formatZodErrors(zodResult.error);
			messages.forEach((m) => console.error('  -', m));
		} catch {
			console.error('  Validation error (raw):', zodResult.error);
		}
	}

	// ── Pass 2: Lookup CSV consistency ─────────────────────────────────────────
	console.log('\nPass 2 — Lookup CSV consistency...');
	const lookupErrors = checkLookupConsistency(data, factorRows, subfactorRows);

	if (lookupErrors.length === 0) {
		console.log('  ✅ Passed');
		pass2Ok = true;
	} else {
		printLookupErrors(lookupErrors);
	}

	// ── Result ─────────────────────────────────────────────────────────────────
	console.log('');
	if (pass1Ok && pass2Ok) {
		console.log('Validation passed ✅');
		process.exitCode = 0;
	} else {
		console.error('Validation failed ❌');
		process.exitCode = 1;
	}
}

main().catch((err) => {
	console.error('Unexpected error:', err);
	process.exitCode = 2;
});
