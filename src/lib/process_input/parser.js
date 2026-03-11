/**
 * src/lib/process_input/parser.js
 *
 * Thin wrapper around PapaParse for parsing CSV files and CSV text.
 * Exports:
 *  - parseFile(file, opts) -> Promise<{ header, rows, meta, errors }>
 *  - parseText(text, opts) -> { header, rows, meta, errors }
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

/**
 * Normalize a cell value to a trimmed string.
 * Treat null/undefined as ''.
 */
function normCell(v) {
  if (v === null || v === undefined) return '';
  // Convert non-string to string, then trim
  return String(v).trim();
}

/**
 * Trim BOM from a string start if present.
 */
function stripBOM(s) {
  if (!s) return s;
  return s.replace(/^\uFEFF/, '');
}

/**
 * Convert PapaParse output (data) to uniform { header, rows } where:
 *  - header: array of strings
 *  - rows: array of array-of-strings
 *
 * data: what Papa returned in res.data
 * opts.header: boolean passed in (if true, Papa returns objects)
 */
function normalizeParsedData(data, opts = {}) {
  const headerMode = !!opts.header;
  if (!Array.isArray(data)) {
    return { header: [], rows: [], warnings: ['Parsed data not an array'] };
  }

  // If Papa was used with header: true, data is an array of objects.
  if (headerMode) {
    // Build header from keys of first row (in insertion order)
    const first = data[0] || {};
    const header = Object.keys(first).map((h) => stripBOM(String(h).trim()));
    const rows = data.map((rowObj) =>
      header.map((h) => normCell(rowObj[h]))
    );
    return { header, rows };
  }

  // headerMode === false: data is array of arrays (each row is array) OR array of objects (if inconsistent)
  // We assume first row is header
  if (data.length === 0) return { header: [], rows: [] };

  // If each row is an object (edge-case), convert like headerMode
  if (data.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
    const first = data[0];
    const header = Object.keys(first).map((h) => stripBOM(String(h).trim()));
    const rows = data.slice(1).map((rowObj) => header.map((h) => normCell(rowObj[h])));
    return { header, rows };
  }

  // Typical case: array of arrays
  const rawHeaderRow = Array.isArray(data[0]) ? data[0] : Object.values(data[0]);
  const header = rawHeaderRow.map((h) => stripBOM(normCell(h)));

  const rows = data.slice(1).map((row) => {
    const arr = Array.isArray(row) ? row.map(normCell) : Object.values(row).map(normCell);
    // pad/truncate to header length
    if (arr.length < header.length) {
      return [...arr, ...Array(header.length - arr.length).fill('')];
    } else if (arr.length > header.length) {
      // keep extra columns, but that's allowed - header length is authoritative for mapping
      return arr;
    }
    return arr;
  });

  return { header, rows };
}

/**
 * parseText - parse CSV text synchronously (returns result object)
 *
 * @param {string} text
 * @param {object} opts - options forwarded to Papa.parse (header, skipEmptyLines, ...).
 *                        Defaults: { header: false, skipEmptyLines: true }
 * @returns {object} { header: string[], rows: string[][], meta, errors }
 */
export function parseText(text, opts = {}) {
  const papaOpts = Object.assign(
    {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false,
      transform: (v) => (v === null || v === undefined ? '' : v)
    },
    opts
  );

  // Papa.parse may throw on extremely malformed input, so guard it
  let res;
  try {
    res = Papa.parse(String(text || ''), papaOpts);
  } catch (err) {
    return {
      header: [],
      rows: [],
      meta: null,
      errors: [{ message: String(err) }]
    };
  }

  const { header, rows } = normalizeParsedData(res.data, papaOpts);

  const errors = Array.isArray(res.errors) ? res.errors.map((e) => ({ ...e })) : [];
  return {
    header,
    rows,
    meta: res.meta || null,
    errors
  };
}

/**
 * parseFile - parse a File or Blob using Papa.parse (async)
 *
 * @param {File|Blob} file
 * @param {object} opts - options forwarded to Papa.parse. Defaults same as parseText.
 * @returns {Promise<{ header, rows, meta, errors }>}
 */
export function parseFile(file, opts = {}) {
  const papaOpts = Object.assign(
    {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false,
      transform: (v) => (v === null || v === undefined ? '' : v)
    },
    opts
  );

  return new Promise((resolve) => {
    // Papa.parse in the browser uses the File/Blob directly
    const config = Object.assign({}, papaOpts, {
      complete: (res) => {
        const { header, rows } = normalizeParsedData(res.data, papaOpts);
        const errors = Array.isArray(res.errors) ? res.errors.map((e) => ({ ...e })) : [];
        resolve({
          header,
          rows,
          meta: res.meta || null,
          errors
        });
      },
      error: (err) => {
        resolve({
          header: [],
          rows: [],
          meta: null,
          errors: [{ message: String(err) }]
        });
      }
    });

    try {
      Papa.parse(file, config);
    } catch (err) {
      resolve({
        header: [],
        rows: [],
        meta: null,
        errors: [{ message: String(err) }]
      });
    }
  });
}
