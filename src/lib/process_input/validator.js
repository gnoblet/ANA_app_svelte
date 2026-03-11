/**
 * src/lib/process_input/validator.js
 *
 * Simple CSV validation utilities for ANA app.
 *
 * Exports:
 *  - validateCsv(header, rows, indicatorMap, opts) -> ValidationResult
 *
 * Validation rules (default):
 *  - Header must include a 'uoa' column (case-insensitive).
 *  - Columns after 'uoa' must match keys in `indicatorMap` (match by trimmed uppercase).
 *  - Each data row must have a non-empty UOA.
 *  - UOA values must be unique across rows (duplicates reported as errors).
 *  - For indicator columns:
 *      - empty cell -> warning (unless opts.requireNonEmpty = true)
 *      - type 'prop' -> numeric between 0 and 1 inclusive
 *      - type 'binary' -> accepts 0 or 1 (also 'yes'/'no'/'true'/'false' as text)
 *      - type 'num_above_0' -> numeric >= 0
 *      - fallback -> numeric (finite)
 *
 * The function is intentionally simple and pure (no DOM). It expects:
 *  - header: array of strings (header row)
 *  - rows: array of array-of-strings (data rows)
 *  - indicatorMap: object keyed by normalized indicator code -> { type, ... }
 *
 * Returned ValidationResult:
 * {
 *   ok: boolean,
 *   headerErrors: string[],
 *   cellErrors: Array<{ row: number, colIndex: number, colName: string, value: string, message: string }>,
 *   warnings: string[],
 *   duplicateUoas: Array<{ uoa: string, rows: number[] }>,
 *   meta: { checkedRows: number, checkedCols: number }
 * }
 */

function normalizeHeaderCell(h) {
	if (h === null || h === undefined) return '';
	return String(h)
		.replace(/^\uFEFF/, '')
		.trim();
}

function normalizeIndicatorKey(k) {
	if (k === null || k === undefined) return '';
	return String(k).trim().toUpperCase();
}

function parseNumber(v) {
	// empty or whitespace -> NaN
	if (v === null || v === undefined) return NaN;
	const s = String(v).trim();
	if (s === '') return NaN;
	// Use Number to parse; this will allow '1', '0.5', '-2', etc. Excludes non-numeric text.
	const n = Number(s);
	return Number.isFinite(n) ? n : NaN;
}

function isBinaryText(v) {
	if (v === null || v === undefined) return false;
	const s = String(v).trim().toLowerCase();
	return s === 'yes' || s === 'no' || s === 'true' || s === 'false';
}

/**
 * checkValueAgainstType
 * @param {string} value
 * @param {string|null|undefined} type
 * @param {object} opts
 * @returns {{ ok: boolean, message?: string, warning?: string }}
 */
function checkValueAgainstType(value, type, opts = {}) {
	const trimmed = value == null ? '' : String(value).trim();
	if (trimmed === '') {
		return opts.requireNonEmpty
			? { ok: false, message: 'empty value' }
			: { ok: true, warning: 'missing' };
	}

	// For binary, accept textual yes/no/true/false as well as numeric 0/1
	if (type === 'binary') {
		const s = trimmed.toLowerCase();
		if (s === '0' || s === '1') return { ok: true };
		if (isBinaryText(trimmed)) return { ok: true };
		return { ok: false, message: 'binary expected (0/1 or yes/no/true/false)' };
	}

	// For others expect numeric
	const n = parseNumber(trimmed);
	if (Number.isNaN(n)) {
		return { ok: false, message: 'not a number' };
	}

	if (type === 'prop') {
		if (n < 0 || n > 1) return { ok: false, message: 'prop must be between 0 and 1' };
		return { ok: true };
	}

	if (type === 'num_above_0') {
		if (n >= 0) return { ok: true };
		return { ok: false, message: 'number must be >= 0' };
	}

	// fallback: any finite number
	return { ok: true };
}

/**
 * validateCsv - main exported function
 *
 * @param {string[]} header - header row (array of strings)
 * @param {string[][]} rows - data rows (array of array-of-strings)
 * @param {Object.<string, object>} indicatorMap - flattened indicator map keyed by normalized code
 * @param {object} opts - options:
 *    - requireNonEmpty: boolean (default false) => treat empty indicator cells as errors
 * @returns {object} ValidationResult
 */
export function validateCsv(header, rows, indicatorMap, opts = {}) {
	const requireNonEmpty = !!opts.requireNonEmpty;

	const headerErrors = [];
	const cellErrors = [];
	const warnings = [];
	const duplicateUoas = [];
	const missingnessMap = Object.create(null); // indicator -> { total: count, missing: count }

	// Basic sanity: header must be an array
	if (!Array.isArray(header)) {
		headerErrors.push('Header is missing or not an array');
		return {
			ok: false,
			headerErrors,
			cellErrors,
			warnings,
			duplicateUoas,
			missingnessMap,
			meta: { checkedRows: 0, checkedCols: 0 }
		};
	}

	// Normalize header cells
	const normalizedHeader = header.map((h) => normalizeHeaderCell(h));

	// Find uoa column (case-insensitive)
	const uoaIndex = normalizedHeader.findIndex((h) => h && h.toLowerCase() === 'uoa');

	if (uoaIndex === -1) {
		headerErrors.push("Header must include a 'uoa' column");
	}

	// Map columns to indicator defs (null for uoa or unknown)
	const colDefs = normalizedHeader.map((h, idx) => {
		if (idx === uoaIndex) return { kind: 'uoa' };
		if (!h) return { kind: 'unknown', raw: h };
		const key = normalizeIndicatorKey(h);
		if (indicatorMap && typeof indicatorMap === 'object' && indicatorMap[key]) {
			return { kind: 'indicator', key, def: indicatorMap[key] };
		}
		// Not found in map
		return { kind: 'unknownIndicator', raw: h, key };
	});

	// Report header unknown indicators as errors
	for (let i = 0; i < colDefs.length; i++) {
		const cd = colDefs[i];
		if (cd.kind === 'unknownIndicator') {
			headerErrors.push(`Header column '${cd.raw}' (col ${i + 1}) is not a known indicator code`);
		}
	}

	// If headerErrors exist, we still may want to continue to gather more info, but caller may treat as fatal.
	// Proceed to row validation unless header missing entirely.
	if (normalizedHeader.length === 0) {
		headerErrors.push('Header row is empty');
	}

	// Don't validate rows if uoa column is missing
	if (uoaIndex === -1) {
		return {
			ok: false,
			headerErrors,
			cellErrors,
			warnings,
			duplicateUoas,
			missingnessMap,
			meta: {
				checkedRows: 0,
				checkedCols: normalizedHeader.length
			}
		};
	}

	// Validate rows
	const uoaToRows = Object.create(null); // uoa -> array of rowNumbers
	for (let r = 0; r < rows.length; r++) {
		const row = Array.isArray(rows[r]) ? rows[r] : [];
		// pad row to header length
		const padded = row.slice(0, normalizedHeader.length);
		if (padded.length < normalizedHeader.length) {
			for (let k = padded.length; k < normalizedHeader.length; k++) padded.push('');
		}

		const rowNum = r + 2; // human-friendly (header is row 1)

		// UOA checks
		let uoaValue = '';
		if (uoaIndex >= 0 && uoaIndex < padded.length) {
			uoaValue = padded[uoaIndex] == null ? '' : String(padded[uoaIndex]).trim();
		} else {
			// no uoa column found in header; treat as missing
			uoaValue = '';
		}

		if (!uoaValue) {
			cellErrors.push({
				row: rowNum,
				colIndex: uoaIndex >= 0 ? uoaIndex : 0,
				colName: uoaIndex >= 0 ? normalizedHeader[uoaIndex] : 'uoa',
				value: uoaValue,
				message: 'uoa is empty'
			});
		} else {
			const key = uoaValue;
			if (!uoaToRows[key]) uoaToRows[key] = [];
			uoaToRows[key].push(rowNum);
		}

		// Validate each indicator column
		for (let c = 0; c < normalizedHeader.length; c++) {
			if (c === uoaIndex) continue; // skip uoa column
			const cd = colDefs[c];
			const value = padded[c] == null ? '' : String(padded[c]).trim();

			if (cd.kind === 'indicator') {
				const type = cd.def && cd.def.type ? String(cd.def.type).trim() : null;
				const colName = normalizedHeader[c];

				// Track missingness for indicator columns
				if (!missingnessMap[colName]) {
					missingnessMap[colName] = { total: 0, missing: 0 };
				}
				missingnessMap[colName].total += 1;

				const check = checkValueAgainstType(value, type, { requireNonEmpty });
				if (!check.ok) {
					cellErrors.push({
						row: rowNum,
						colIndex: c,
						colName: colName,
						value,
						message: check.message || 'invalid value'
					});
				} else if (check.warning) {
					// missing cell - count it
					missingnessMap[colName].missing += 1;
				}
			} else if (cd.kind === 'unknownIndicator') {
				// Skip validation for unknown indicator columns - let user decide what to do
				// Just note that the column exists
			} else {
				// unknown / blank header column - skip or warn if there's a value
				if (value !== '') {
					warnings.push(`Row ${rowNum}, column ${c + 1} (unnamed): has value '${value}'`);
				}
			}
		}
	}

	// Find duplicates in UOA map
	for (const uoa in uoaToRows) {
		if (Object.prototype.hasOwnProperty.call(uoaToRows, uoa)) {
			const list = uoaToRows[uoa];
			if (Array.isArray(list) && list.length > 1) {
				duplicateUoas.push({ uoa, rows: list.slice() });
				// Also add cellErrors for each row occurrence (could be redundant with earlier empty check)
				for (const rn of list) {
					cellErrors.push({
						row: rn,
						colIndex: uoaIndex >= 0 ? uoaIndex : 0,
						colName: uoaIndex >= 0 ? normalizedHeader[uoaIndex] : 'uoa',
						value: uoa,
						message: `duplicate uoa '${uoa}'`
					});
				}
			}
		}
	}

	// Compose final result
	const ok = headerErrors.length === 0 && cellErrors.length === 0;

	// Attempt to convert indicator columns to numeric values.
	// We only expose `numericRows` if all indicator cells that are non-empty
	// can be parsed to a finite number. Empty indicator cells become `null`.
	// If any non-empty indicator cell cannot be parsed as a number, we do not
	// provide `numericRows` (it remains `null`) — the validator will already
	// have reported the corresponding cell error(s).
	let numericRows = null;
	if (Array.isArray(rows) && rows.length > 0) {
		const converted = [];
		let numericConversionOk = true;

		for (let r = 0; r < rows.length; r++) {
			const row = Array.isArray(rows[r]) ? rows[r] : [];
			// pad row to header length
			const padded = row.slice(0, normalizedHeader.length);
			if (padded.length < normalizedHeader.length) {
				for (let k = padded.length; k < normalizedHeader.length; k++) padded.push('');
			}

			const outRow = new Array(normalizedHeader.length);
			for (let c = 0; c < normalizedHeader.length; c++) {
				const cd = colDefs[c];
				const raw = padded[c] == null ? '' : String(padded[c]).trim();

				if (cd.kind === 'indicator') {
					// empty -> null
					if (raw === '') {
						outRow[c] = null;
					} else {
						const n = Number(raw);
						if (Number.isNaN(n)) {
							// Can't convert this cell to a number -> mark failure but keep original
							numericConversionOk = false;
							outRow[c] = raw;
						} else {
							outRow[c] = n;
						}
					}
				} else {
					// keep non-indicator cells (uoa, unknown) as trimmed strings
					outRow[c] = raw;
				}
			}

			converted.push(outRow);
		}

		if (numericConversionOk) {
			numericRows = converted;
		}
	}

	return {
		ok,
		headerErrors,
		cellErrors,
		warnings,
		duplicateUoas,
		missingnessMap,
		// `numericRows` is either null (conversion failed / not provided) or an
		// array of rows with indicator columns converted to numbers (and empty
		// indicator cells as `null`).
		numericRows,
		meta: {
			checkedRows: rows.length,
			checkedCols: normalizedHeader.length
		}
	};
}
