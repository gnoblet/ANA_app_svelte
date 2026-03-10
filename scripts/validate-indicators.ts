#!/usr/bin/env bun
import fs from 'fs';
import path from 'path';
import { safeValidateIndicatorsRoot, formatZodErrors } from '../src/lib/types/indicators';

async function main() {
  const jsonPath = path.resolve(process.cwd(), 'static/data/indicators.json');

  if (!fs.existsSync(jsonPath)) {
    console.error('File not found:', jsonPath);
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

  const result = safeValidateIndicatorsRoot(data);

  if (result.success) {
    console.log('Validation passed ✅');
    process.exitCode = 0;
    return;
  }

  console.error('Validation failed ❌');
  try {
    const messages = formatZodErrors(result.error);
    messages.forEach((m) => console.error('-', m));
  } catch (err) {
    // Fallback: print raw error if formatting fails
    console.error('Validation error (raw):', result.error);
  }

  process.exitCode = 1;
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exitCode = 2;
});
