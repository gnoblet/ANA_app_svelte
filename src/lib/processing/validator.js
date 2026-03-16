/**
 * src/lib/processing/validator.js
 *
 * Simple CSV validation utilities for ANA app.
 *
 * Exports:
 *  - validateCsv(header, rows, indicatorMap, opts) -> ValidationResult
 *
 * ─── Type column syntax ───────────────────────────────────────────────────────
 *
 *   type  = base ( '[' range ']' )?
 *   base  = 'num' | 'int'
 *   range = bound ':' bound   (closed interval [lb, ub])
 *         | bound '+'          (half-open: value >= lb)
 *   bound = number             (integer or decimal)
 *
 *   Examples: num  num[0+]  num[0:1]  num[0:24]  int[0+]  int[0:1]  int[1:5]
 *
 *   type: null → no type constraint; any finite number is accepted.
 *   Unknown format string → warning only, value is not rejected.
 *
 * ─── Validation rules ─────────────────────────────────────────────────────────
 *
 *   - Header must include a 'uoa' column (case-insensitive).
 *   - Columns after 'uoa' must match keys in `indicatorMap`.
 *   - Each data row must have a non-empty UOA.
 *   - UOA values must be unique (duplicates reported as errors).
 *   - For indicator columns:
 *       - empty cell         → warning (unless opts.requireNonEmpty = true → error)
 *       - type: null         → accept any finite number, no bounds applied
 *       - type: 'num[lb:ub]' → finite number within [lb, ub]
 *       - type: 'num[lb+]'   → finite number >= lb
 *       - type: 'num'        → any finite number
 *       - type: 'int[lb:ub]' → integer within [lb, ub]
 *       - type: 'int[lb+]'   → integer >= lb
 *       - type: 'int'        → any integer
 *       - unrecognised type  → warning, value accepted as-is if finite
 *
 * ─── Note on label columns ────────────────────────────────────────────────────
 *
 *   The indicator JSON may contain `thresholds.an_label` and
 *   `thresholds.van_label` for UI display. These label fields are NEVER used
 *   for validation. Only the numeric `an` / `van` values and the `type` string
 *   drive validation logic.
 *
 * ─── Note on van requires an ─────────────────────────────────────────────────
 *
 *   The rule "van cannot be set without an" is a schema-level constraint
 *   enforced by the Zod schema in src/lib/types/indicators.ts. This validator
 *   operates on user-supplied CSV cell values and does not re-enforce it.
 *
 * ─── Returned ValidationResult ───────────────────────────────────────────────
 *
 * {
 *   ok: boolean,
 *   headerErrors: string[],
 *   cellErrors: Array<{
 *     row: number, colIndex: number, colName: string,
 *     value: string, message: string
 *   }>,
 *   warnings: string[],
 *   duplicateUoas: Array<{ uoa: string, rows: number[] }>,
 *   missingnessMap: Object.<string, { total: number, missing: number }>,
 *   numericRows: number[][] | null,
 *   numericObjects: Object[] | null,
 *   meta: { checkedRows: number, checkedCols: number }
 * }
 */

// ── Internal helpers ──────────────────────────────────────────────────────────

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
	if (v === null || v === undefined) return NaN;
	const s = String(v).trim();
	if (s === '') return NaN;
	const n = Number(s);
	return Number.isFinite(n) ? n : NaN;
}

// ── Type parser ───────────────────────────────────────────────────────────────

/**
 * Parse a type string into its components.
 *
 * @param {string|null|undefined} type
 * @returns {{ base: 'num'|'int', lb: number|null, ub: number|null, isOpen: boolean } | null}
 *   Returns null when type is falsy (null / undefined / empty string) OR when
 *   the string does not match the expected syntax. Callers must distinguish:
 *     - null input   → no type constraint (skip bounds checks)
 *     - non-null but parseIndicatorType returns null → unrecognised format
 */
function parseIndicatorType(type) {
	if (!type) return null;
	const m = String(type).match(/^(num|int)(?:\[(\d+(?:\.\d+)?)(?::(\d+(?:\.\d+)?)|(\+))\])?$/);
	if (!m) return null;
	return {
		base: m[1], // 'num' | 'int'
		lb: m[2] != null ? Number(m[2]) : null,
		ub: m[3] != null ? Number(m[3]) : null,
		isOpen: m[4] === '+'
	};
}

// ── Cell-level validation ─────────────────────────────────────────────────────

/**
 * Check a single cell value against the indicator's type constraint.
 *
 * @param {string} value  - raw cell value (may be empty)
 * @param {string|null|undefined} type  - indicator type string or null
 * @param {object} opts
 * @param {boolean} [opts.requireNonEmpty=false]  - treat empty as error instead of warning
 * @returns {{ ok: boolean, message?: string, warning?: string }}
 */
function checkValueAgainstType(value, type, opts = {}) {
	const trimmed = value == null ? '' : String(value).trim();

	// ── Empty cell ────────────────────────────────────────────────────────────
	if (trimmed === '') {
		return opts.requireNonEmpty
			? { ok: false, message: 'empty value' }
			: { ok: true, warning: 'missing' };
	}

	// ── type: null → no type constraint ──────────────────────────────────────
	// The source CSV had an empty Type column for this indicator.
	// Accept any finite number without bounds checking.
	if (type == null || String(type).trim() === '') {
		const n = Number(trimmed);
		if (!Number.isFinite(n)) {
			return { ok: false, message: 'not a finite number' };
		}
		return { ok: true };
	}

	// ── Attempt to parse the type string ─────────────────────────────────────
	const parsed = parseIndicatorType(type);

	if (!parsed) {
		// Unrecognised type format — warn but do not reject the value.
		// The generator should have caught malformed types; this is a safety net.
		const n = Number(trimmed);
		if (!Number.isFinite(n)) {
			return { ok: false, message: 'not a finite number' };
		}
		return { ok: true, warning: `unrecognised type '${type}' — accepted as finite number` };
	}

	// ── Numeric check ─────────────────────────────────────────────────────────
	const n = Number(trimmed);
	if (!Number.isFinite(n)) {
		return { ok: false, message: 'not a finite number' };
	}

	// ── Integer check (for 'int' base) ────────────────────────────────────────
	if (parsed.base === 'int' && !Number.isInteger(n)) {
		return {
			ok: false,
			message: `type '${type}' requires an integer, got ${trimmed}`
		};
	}

	// ── Lower bound check ─────────────────────────────────────────────────────
	if (parsed.lb != null && n < parsed.lb) {
		return {
			ok: false,
			message: `value ${n} is below minimum ${parsed.lb} (type '${type}')`
		};
	}

	// ── Upper bound check (closed intervals only) ─────────────────────────────
	if (!parsed.isOpen && parsed.ub != null && n > parsed.ub) {
		return {
			ok: false,
			message: `value ${n} exceeds maximum ${parsed.ub} (type '${type}')`
		};
	}

	return { ok: true };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * validateCsv — validate a parsed CSV against the indicator map.
 *
 * @param {string[]} header - header row (array of strings)
 * @param {string[][]} rows - data rows (array of array-of-strings)
 * @param {Object.<string, object>} indicatorMap
 *   Flattened indicator map keyed by normalised indicator code (uppercase).
 *   Each value is an indicator definition object. The `type` property of each
 *   definition drives cell-level validation. `thresholds.an_label` and
 *   `thresholds.van_label` are intentionally ignored here.
 * @param {object} [opts]
 *   - requireNonEmpty {boolean} (default false) — treat empty indicator cells as errors
 * @returns {object} ValidationResult
 */
export function validateCsv(header, rows, indicatorMap, opts = {}) {
	const requireNonEmpty = !!opts.requireNonEmpty;

	const headerErrors = [];
	const cellErrors = [];
	const warnings = [];
	const duplicateUoas = [];
	/** @type {Object.<string, { total: number, missing: number }>} */
	const missingnessMap = Object.create(null);

	// ── Sanity: header must be an array ──────────────────────────────────────
	if (!Array.isArray(header)) {
		headerErrors.push('Header is missing or not an array');
		return {
			ok: false,
			headerErrors,
			cellErrors,
			warnings,
			duplicateUoas,
			missingnessMap,
			numericRows: null,
			numericObjects: null,
			meta: { checkedRows: 0, checkedCols: 0 }
		};
	}

	// ── Normalise header cells ────────────────────────────────────────────────
	const normalizedHeader = header.map((h) => normalizeHeaderCell(h));

	// ── Locate uoa column ─────────────────────────────────────────────────────
	const uoaIndex = normalizedHeader.findIndex((h) => h && h.toLowerCase() === 'uoa');
	if (uoaIndex === -1) {
		headerErrors.push("Header must include a 'uoa' column");
	}

	// ── Map every column to its role ──────────────────────────────────────────
	const colDefs = normalizedHeader.map((h, idx) => {
		if (idx === uoaIndex) return { kind: 'uoa' };
		if (!h) return { kind: 'unknown', raw: h };
		const key = normalizeIndicatorKey(h);
		if (indicatorMap && typeof indicatorMap === 'object' && indicatorMap[key]) {
			return { kind: 'indicator', key, def: indicatorMap[key] };
		}
		return { kind: 'unknownIndicator', raw: h, key };
	});

	// ── Report unknown indicator columns ──────────────────────────────────────
	for (let i = 0; i < colDefs.length; i++) {
		const cd = colDefs[i];
		if (cd.kind === 'unknownIndicator') {
			headerErrors.push(`Header column '${cd.raw}' (col ${i + 1}) is not a known indicator code`);
		}
	}

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
			numericRows: null,
			numericObjects: null,
			meta: { checkedRows: 0, checkedCols: normalizedHeader.length }
		};
	}

	// ── Row validation ────────────────────────────────────────────────────────
	/** @type {Object.<string, number[]>} */
	const uoaToRows = Object.create(null);

	for (let r = 0; r < rows.length; r++) {
		const row = Array.isArray(rows[r]) ? rows[r] : [];

		// Pad row to header length
		const padded = row.slice(0, normalizedHeader.length);
		while (padded.length < normalizedHeader.length) padded.push('');

		const rowNum = r + 2; // human-friendly (header is row 1)

		// ── UOA checks ──────────────────────────────────────────────────────
		let uoaValue = '';
		if (uoaIndex >= 0 && uoaIndex < padded.length) {
			uoaValue = padded[uoaIndex] == null ? '' : String(padded[uoaIndex]).trim();
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
			if (!uoaToRows[uoaValue]) uoaToRows[uoaValue] = [];
			uoaToRows[uoaValue].push(rowNum);
		}

		// ── Indicator column checks ──────────────────────────────────────────
		for (let c = 0; c < normalizedHeader.length; c++) {
			if (c === uoaIndex) continue;

			const cd = colDefs[c];
			if (cd.kind !== 'indicator') {
				// Unnamed / unknown column: warn only if it contains a value
				if (cd.kind !== 'unknownIndicator') {
					const raw = padded[c] == null ? '' : String(padded[c]).trim();
					if (raw !== '') {
						warnings.push(`Row ${rowNum}, column ${c + 1} (unnamed): has value '${raw}'`);
					}
				}
				continue;
			}

			const value = padded[c] == null ? '' : String(padded[c]).trim();
			const colName = normalizedHeader[c];

			// Resolve the type from the indicator definition.
			// `type` may be null (empty Type in reference CSV) — handled by checkValueAgainstType.
			const type =
				cd.def && cd.def.type !== undefined && cd.def.type !== null
					? String(cd.def.type).trim() || null
					: null;

			// Track missingness
			if (!missingnessMap[colName]) {
				missingnessMap[colName] = { total: 0, missing: 0 };
			}
			missingnessMap[colName].total += 1;

			const check = checkValueAgainstType(value, type, { requireNonEmpty });

			if (!check.ok) {
				cellErrors.push({
					row: rowNum,
					colIndex: c,
					colName,
					value,
					message: check.message || 'invalid value'
				});
			} else if (check.warning) {
				if (check.warning === 'missing') {
					missingnessMap[colName].missing += 1;
				} else {
					warnings.push(`Row ${rowNum}, col '${colName}': ${check.warning}`);
				}
			}
		}
	}

	// ── Duplicate UOA detection ───────────────────────────────────────────────
	for (const uoa in uoaToRows) {
		if (!Object.prototype.hasOwnProperty.call(uoaToRows, uoa)) continue;
		const list = uoaToRows[uoa];
		if (Array.isArray(list) && list.length > 1) {
			duplicateUoas.push({ uoa, rows: list.slice() });
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

	// ── Numeric conversion ────────────────────────────────────────────────────
	// Attempt to convert all indicator cells to numbers.
	// Empty indicator cells → null. Non-numeric → conversion fails (numericRows stays null).
	let numericRows = null;
	let numericObjects = null;

	if (Array.isArray(rows) && rows.length > 0) {
		const converted = [];
		let conversionOk = true;

		for (let r = 0; r < rows.length; r++) {
			const row = Array.isArray(rows[r]) ? rows[r] : [];
			const padded = row.slice(0, normalizedHeader.length);
			while (padded.length < normalizedHeader.length) padded.push('');

			const outRow = new Array(normalizedHeader.length);
			for (let c = 0; c < normalizedHeader.length; c++) {
				const cd = colDefs[c];
				const raw = padded[c] == null ? '' : String(padded[c]).trim();

				if (cd.kind === 'indicator') {
					if (raw === '') {
						outRow[c] = null;
					} else {
						const n = Number(raw);
						if (Number.isNaN(n)) {
							conversionOk = false;
							outRow[c] = raw;
						} else {
							outRow[c] = n;
						}
					}
				} else {
					outRow[c] = raw;
				}
			}

			converted.push(outRow);
		}

		if (conversionOk) {
			numericRows = converted;
			numericObjects = numericRows.map((r) => {
				const obj = {};
				for (let c = 0; c < normalizedHeader.length; c++) {
					obj[normalizedHeader[c]] = r[c];
				}
				return obj;
			});
		}
	}

	// ── Final result ──────────────────────────────────────────────────────────
	const ok = headerErrors.length === 0 && cellErrors.length === 0;

	return {
		ok,
		headerErrors,
		cellErrors,
		warnings,
		duplicateUoas,
		missingnessMap,
		numericRows,
		numericObjects,
		meta: {
			checkedRows: rows.length,
			checkedCols: normalizedHeader.length
		}
	};
}
