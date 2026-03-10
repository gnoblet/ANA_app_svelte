#!/usr/bin/env bun
/**
 * Script: generate-factor-enum.ts
 *
 * Reads `static/data/factor.csv` and generates a TypeScript file exporting a string enum
 * `FactorIDEnum` into `src/lib/types/generated/factor-enum.ts`.
 *
 * Usage:
 *   bun ./scripts/generate-factor-enum.ts
 *
 * Behavior:
 * - Expects CSV with header row that includes a column named `factor` (case-insensitive).
 * - Reads unique factor ids from the CSV and emits an enum where each member name is a
 *   PascalCase identifier derived from the factor id and the value is the original id.
 * - Creates output directory if necessary and overwrites the file.
 *
 * Output example:
 *   export enum FactorIDEnum {
 *     NutritionStatus = 'nutrition_status',
 *     HealthStatus = 'health_status',
 *     MortalityOutcome = 'mortality_outcome'
 *   }
 *
 * Note: This script uses a simple CSV parser adequate for well-formed CSVs without
 * quoted commas/newlines. If your CSVs include quoted fields with commas/newlines,
 * consider using a proper CSV parser library.
 */

import fs from 'fs';
import path from 'path';

const INPUT_CSV = path.join(process.cwd(), 'static', 'data', 'factor.csv');
const OUTPUT_TS = path.join(process.cwd(), 'src', 'lib', 'types', 'generated', 'factor-enum.ts');

/** Convert a string like "nutrition_status" or "nutrition-status" or "nutrition status" to PascalCase identifier */
function toPascalCaseId(s: string): string {
  if (!s) return '_';
  const parts = s.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const pascal = parts
    .map((p) => {
      const safe = /^[0-9]/.test(p) ? `_${p}` : p;
      return safe.charAt(0).toUpperCase() + safe.slice(1);
    })
    .join('');
  if (/^[0-9]/.test(pascal)) return `_${pascal}`;
  return pascal || '_';
}

/** Very simple CSV reader for basic comma-separated files (no quoted fields) */
function readCsvSimple(filePath: string): string[][] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((l) => l.trim() !== '');
  return lines.map((line) => line.split(',').map((c) => c.trim()));
}

function generateEnumContent(entries: Array<{ key: string; value: string }>, sourceFileRelative: string) {
  const header = `/**
 * THIS FILE IS GENERATED — DO NOT EDIT BY HAND
 * Generated from: ${sourceFileRelative}
 * Generated at: ${new Date().toISOString()}
 */\n\n`;
  const enumLines = ['export enum FactorIDEnum {'];
  for (const e of entries) {
    enumLines.push(`\t${e.key} = '${e.value}',`);
  }
  enumLines.push('}\n');
  enumLines.push('// Convenience array of ids');
  enumLines.push('export const FactorIDs = Object.values(FactorIDEnum) as FactorIDEnum[];\n');
  enumLines.push('export type FactorID = FactorIDEnum;\n');
  return header + enumLines.join('\n');
}

function main() {
  try {
    if (!fs.existsSync(INPUT_CSV)) {
      console.error(`Input CSV not found: ${INPUT_CSV}`);
      process.exitCode = 2;
      return;
    }

    const rows = readCsvSimple(INPUT_CSV);
    if (rows.length === 0) {
      console.error('CSV is empty');
      process.exitCode = 2;
      return;
    }

    // Determine index of "factor" column from header (case-insensitive)
    const header = rows[0].map((h) => h.toLowerCase());
    let factorIdx = header.indexOf('factor');
    if (factorIdx === -1) {
      // fallback: assume first column
      factorIdx = 0;
    }

    const ids: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (factorIdx >= row.length) continue;
      const raw = row[factorIdx].trim();
      if (!raw) continue;
      ids.push(raw);
    }

    const unique = Array.from(new Set(ids));
    if (unique.length === 0) {
      console.error('No factor ids found in CSV');
      process.exitCode = 2;
      return;
    }

    // Build enum entries ensuring unique keys
    const usedKeys = new Map<string, number>();
    const entries: Array<{ key: string; value: string }> = [];
    for (const id of unique) {
      let base = toPascalCaseId(id);
      if (!base) base = 'Factor';
      let key = base;
      if (usedKeys.has(key)) {
        const count = (usedKeys.get(key) || 1) + 1;
        usedKeys.set(key, count);
        key = `${base}${count}`;
      } else {
        usedKeys.set(key, 1);
      }
      entries.push({ key, value: id });
    }

    // Ensure output directory exists
    const outDir = path.dirname(OUTPUT_TS);
    fs.mkdirSync(outDir, { recursive: true });

    const relSource = path.relative(outDir, INPUT_CSV) || INPUT_CSV;
    const content = generateEnumContent(entries, relSource);
    fs.writeFileSync(OUTPUT_TS, content, 'utf-8');
    console.log(`Generated ${OUTPUT_TS} (${entries.length} entries)`);
    process.exitCode = 0;
  } catch (err) {
    console.error('Error generating enum:', err);
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main();
}
