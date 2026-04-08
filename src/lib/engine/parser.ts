/**
 * src/lib/engine/parser.ts
 *
 * Thin wrapper around PapaParse for parsing CSV files and CSV text.
 * Exports:
 *  - parseFile(file, opts) -> Promise<ParseResult>
 *  - parseText(text, opts) -> ParseResult
 *
 * Notes:
 *  - Uses PapaParse to robustly parse CSV (quoted fields, embedded commas/newlines, etc).
 *  - By default parsing mode is header: false (the first row is treated as header row).
 *    You may pass opts.header = true to treat rows as objects (we will convert them back
 *    to a header + rows array for consistent output).
 *  - opts is forwarded into Papa.parse but some defaults are set:
 *      { header: false, skipEmptyLines: true, dynamicTyping: false }
 *  - Returned rows are arrays of strings (trimmed). Header entries are trimmed strings.
 *  - Rows are padded with empty strings if they contain fewer fields than header.
 */

import Papa from 'papaparse';

/* --------------------- Types --------------------- */

export type ParseOptions = {
	header?: boolean;
	skipEmptyLines?: boolean;
	dynamicTyping?: boolean;
	transform?: (v: any) => any;
	[key: string]: any;
};

export type ParseResult = {
	header: string[];
	rows: string[][];
	meta: any;
	errors: Array<{ message?: string; [key: string]: any }>;
};

/* --------------------- Helpers --------------------- */

/** Normalize a cell value to a trimmed string. Treat null/undefined as ''. */
function normCell(v: unknown): string {
	if (v === null || v === undefined) return '';
	return String(v).trim();
}

/** Trim BOM from a string start if present. */
function stripBOM(s: string): string {
	if (!s) return s;
	return s.replace(/^\uFEFF/, '');
}

/**
 * Convert PapaParse output to uniform { header, rows } where header is string[]
 * and rows is string[][].
 */
function normalizeParsedData(data: any[], opts: ParseOptions = {}): Pick<ParseResult, 'header' | 'rows'> {
	const headerMode = !!opts.header;
	if (!Array.isArray(data)) {
		return { header: [], rows: [] };
	}

	// If Papa was used with header: true, data is an array of objects.
	if (headerMode) {
		const first = data[0] || {};
		const header = Object.keys(first).map((h) => stripBOM(String(h).trim()));
		const rows = data.map((rowObj) => header.map((h) => normCell(rowObj[h])));
		return { header, rows };
	}

	if (data.length === 0) return { header: [], rows: [] };

	// If each row is an object (edge-case), convert like headerMode
	if (data.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
		const first = data[0];
		const header = Object.keys(first).map((h) => stripBOM(String(h).trim()));
		const rows = data.slice(1).map((rowObj) => header.map((h) => normCell(rowObj[h])));
		return { header, rows };
	}

	// Typical case: array of arrays
	const rawHeaderRow: any[] = Array.isArray(data[0]) ? data[0] : Object.values(data[0]);
	const header = rawHeaderRow.map((h) => stripBOM(normCell(h)));

	const rows = data.slice(1).map((row) => {
		const arr: string[] = Array.isArray(row) ? row.map(normCell) : Object.values(row).map(normCell);
		if (arr.length < header.length) {
			return [...arr, ...Array(header.length - arr.length).fill('')];
		}
		return arr;
	});

	return { header, rows };
}

/* --------------------- Exports --------------------- */

/** Parse CSV text synchronously. */
export function parseText(text: string, opts: ParseOptions = {}): ParseResult {
	const papaOpts = {
		header: false,
		skipEmptyLines: true,
		dynamicTyping: false,
		transform: (v: any) => (v === null || v === undefined ? '' : v),
		...opts
	};

	let res: Papa.ParseResult<any>;
	try {
		res = Papa.parse(String(text || ''), papaOpts);
	} catch (err) {
		return { header: [], rows: [], meta: null, errors: [{ message: String(err) }] };
	}

	const { header, rows } = normalizeParsedData(res.data, papaOpts);
	const errors = Array.isArray(res.errors) ? res.errors.map((e) => ({ ...e })) : [];
	return { header, rows, meta: res.meta || null, errors };
}

/** Parse a File or Blob using Papa.parse (async). */
export function parseFile(file: File | Blob, opts: ParseOptions = {}): Promise<ParseResult> {
	const papaOpts = {
		header: false,
		skipEmptyLines: true,
		dynamicTyping: false,
		transform: (v: any) => (v === null || v === undefined ? '' : v),
		...opts
	};

	return new Promise((resolve) => {
		const config = {
			...papaOpts,
			complete: (res: Papa.ParseResult<any>) => {
				const { header, rows } = normalizeParsedData(res.data, papaOpts);
				const errors = Array.isArray(res.errors) ? res.errors.map((e) => ({ ...e })) : [];
				resolve({ header, rows, meta: res.meta || null, errors });
			},
			error: (err: any) => {
				resolve({ header: [], rows: [], meta: null, errors: [{ message: String(err) }] });
			}
		};

		try {
			Papa.parse(file, config);
		} catch (err) {
			resolve({ header: [], rows: [], meta: null, errors: [{ message: String(err) }] });
		}
	});
}
