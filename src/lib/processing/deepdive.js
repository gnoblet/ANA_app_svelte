// ── ExcelJS package — change this one line to switch between fork and upstream ──
import ExcelJS from '@protobi/exceljs';

// Type aliases — only the import path above ever needs updating
/** @typedef {import('@protobi/exceljs').Worksheet} ExcelWorksheet */
/** @typedef {import('@protobi/exceljs').Cell} ExcelCell */
/** @typedef {import('@protobi/exceljs').Fill} ExcelFill */
/** @typedef {import('@protobi/exceljs').Border} ExcelBorder */
/** @typedef {import('@protobi/exceljs').Borders} ExcelBorders */
/** @typedef {import('@protobi/exceljs').DataValidation} ExcelDataValidation */
/** @typedef {{ primaryHypRow: number, secondaryHypRow: number, plausibilityRow: number, summaryRow: number, triangulationRow: number, conclusionRow: number }} SynthesisRows */
/** @typedef {{ sheetName: string, system: Record<string, any>, synthesisRows: SynthesisRows }} SheetMeta */

/**
 * Deep Dive Excel export — one file per unit of analysis.
 *
 * Workbook layout:
 *   - One worksheet per system (tab = system label)
 *   - Each worksheet:
 *       System header (full-width, dark blue)
 *       For each factor:
 *         Factor row  (label left | flag summary right, light blue)
 *         For each sub-factor:
 *           Sub-factor row  (label left | flag summary right, light green)
 *           Table header:  Indicator | Label | Metric | Value | Flag | AN Threshold | Direction | H1–H5 | Comment
 *           Indicator rows (flagged rows have a light-red tint)
 */

// ── Layout constants ─────────────────────────────────────────────────────────

/** Total number of columns (A..M) */
const COL_COUNT = 13;

/** Column widths (1-indexed, A=1 … M=13) */
const COL_WIDTHS = [14, 32, 22, 10, 14, 16, 12, 16, 16, 16, 16, 16, 28];

/** Human-readable table headers matching COL_WIDTHS */
const TABLE_HEADERS = [
	'Indicator',
	'Label',
	'Metric',
	'Value',
	'Flag',
	'AN Threshold',
	'Direction',
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'Comment'
];

// ── Style helpers ────────────────────────────────────────────────────────────

/** 
 * @param {string} argb
 * @returns {ExcelFill}
 */
function solidFill(argb) {
	return /** @type {ExcelFill} */ ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
}

/** 
 * @param {string} [argb]
 * @returns {ExcelBorder}
 */
function thinLine(argb = 'FFCCCCCC') {
	return /** @type {ExcelBorder} */ ({ style: 'thin', color: { argb } });
}

/** 
 * @param {string} [argb]
 * @returns {Partial<ExcelBorders>}
 */
function allBorders(argb = 'FFCCCCCC') {
	const s = thinLine(argb);
	return { top: s, left: s, bottom: s, right: s };
}

/** @param {string} flagLabelStr */
function flagArgb(flagLabelStr) {
	if (flagLabelStr === 'flag') return 'FFCC0000';
	if (flagLabelStr === 'noflag') return 'FF00703C';
	return 'FF888888';
}

/** @param {string} flagLabelStr */
function flagDisplayText(flagLabelStr) {
	if (flagLabelStr === 'flag') return 'Flagged';
	if (flagLabelStr === 'noflag') return 'Not flagged';
	return 'No data';
}

/**
 * @param {number} flagN
 * @param {number} noFlagN
 * @param {number} missingN
 */
function sectionSummary(flagN, noFlagN, missingN) {
	const total = flagN + noFlagN + missingN;
	const status = flagN > 0 ? 'FLAGGED' : total > 0 ? 'Not flagged' : 'No data';
	return `${status}   (flagged: ${flagN}  not flagged: ${noFlagN}  missing: ${missingN})`;
}

// ── Row builders ─────────────────────────────────────────────────────────────

/**
 * @param {ExcelWorksheet} ws
 * @param {string} systemLabel
 * @param {string} uoaId
 */
function addSystemHeader(ws, systemLabel, uoaId) {
	const row = ws.addRow(new Array(COL_COUNT).fill(''));
	ws.mergeCells(row.number, 1, row.number, COL_COUNT);
	const cell = row.getCell(1);
	cell.value = `${systemLabel}  —  UOA: ${uoaId}`;
	cell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
	cell.fill = solidFill('FF1F4E79');
	cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
	row.height = 26;
}

/**
 * @param {ExcelWorksheet} ws
 * @param {string} factorLabel
 * @param {number} flagN
 * @param {number} noFlagN
 * @param {number} missingN
 */
function addFactorRow(ws, factorLabel, flagN, noFlagN, missingN) {
	const isFlagged = flagN > 0;
	const row = ws.addRow(new Array(COL_COUNT).fill(''));

	ws.mergeCells(row.number, 1, row.number, 7);
	ws.mergeCells(row.number, 8, row.number, COL_COUNT);

	const labelCell = row.getCell(1);
	labelCell.value = `FACTOR  ${factorLabel}`;
	labelCell.font = { bold: true, size: 12 };
	labelCell.fill = solidFill('FFBDD7EE');
	labelCell.alignment = { vertical: 'middle', indent: 1 };

	const statusCell = row.getCell(8);
	statusCell.value = sectionSummary(flagN, noFlagN, missingN);
	statusCell.font = { bold: true, color: { argb: isFlagged ? 'FFCC0000' : 'FF00703C' } };
	statusCell.fill = solidFill('FFBDD7EE');
	statusCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

	row.height = 20;
}

/**
 * @param {ExcelWorksheet} ws
 * @param {string} subfactorLabel
 * @param {number} flagN
 * @param {number} noFlagN
 * @param {number} missingN
 */
function addSubfactorRow(ws, subfactorLabel, flagN, noFlagN, missingN) {
	const isFlagged = flagN > 0;
	const row = ws.addRow(new Array(COL_COUNT).fill(''));

	ws.mergeCells(row.number, 1, row.number, 7);
	ws.mergeCells(row.number, 8, row.number, COL_COUNT);

	const labelCell = row.getCell(1);
	labelCell.value = `  Sub-factor  ${subfactorLabel}`;
	labelCell.font = { italic: true, size: 11 };
	labelCell.fill = solidFill('FFE2EFDA');
	labelCell.alignment = { vertical: 'middle', indent: 1 };

	const statusCell = row.getCell(8);
	statusCell.value = sectionSummary(flagN, noFlagN, missingN);
	statusCell.font = { italic: true, color: { argb: isFlagged ? 'FFCC0000' : 'FF00703C' } };
	statusCell.fill = solidFill('FFE2EFDA');
	statusCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };

	row.height = 18;
}

/** @param {ExcelWorksheet} ws */
function addTableHeaderRow(ws) {
	const row = ws.addRow(TABLE_HEADERS);
	/** @param {ExcelCell} cell */
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 10 };
		cell.fill = solidFill('FFF2F2F2');
		cell.border = {
			top: thinLine('FFAAAAAA'),
			left: thinLine('FFAAAAAA'),
			bottom: { style: 'medium', color: { argb: 'FF666666' } },
			right: thinLine('FFAAAAAA')
		};
		cell.alignment = { vertical: 'middle', wrapText: false };
	});
	row.height = 16;
}

/**
 * @param {ExcelWorksheet} ws
 * @param {{ id: string, label: string|null, metric: string|null, value: number|null, flagLabelStr: string, an: number|null, direction: string|null }} params
 */
function addIndicatorRow(ws, { id, label, metric, value, flagLabelStr, an, direction }) {
	const rowValues = [
		id,
		label ?? '',
		metric ?? '',
		value === null || value === undefined ? '' : value,
		flagDisplayText(flagLabelStr),
		an === null || an === undefined ? '' : an,
		direction ?? '',
		'', // H1
		'', // H2
		'', // H3
		'', // H4
		'', // H5
		'' //  Comment
	];

	const row = ws.addRow(rowValues);
	const isFlagged = flagLabelStr === 'flag';

	row.eachCell(/** @param {ExcelCell} cell @param {number} colNum */ (cell, colNum) => {
		cell.border = allBorders('FFDDDDDD');
		cell.alignment = { vertical: 'middle' };
		// Light red tint on data columns only (A-G) when flagged
		if (isFlagged && colNum <= 7) {
			cell.fill = solidFill('FFFFF0F0');
		}
	});

	// Colour the Flag cell (col 5 = E)
	const flagCell = row.getCell(5);
	flagCell.font = { color: { argb: flagArgb(flagLabelStr) }, bold: isFlagged };

	// Dropdown validation for H1–H5 (columns 8–12)
	/** @type {ExcelDataValidation} */
	const hypothesisValidation = {
		type: 'list',
		allowBlank: true,
		formulae: ['"++,+,~,-,--"'],
		showErrorMessage: false
	};
	for (let col = 8; col <= 12; col++) {
		row.getCell(col).dataValidation = hypothesisValidation;
	}

	row.height = 15;
}

// ── Summary / conclusion section ────────────────────────────────────────────

/**
 * A single label | dropdown row in the summary section.
 * @param {ExcelWorksheet} ws
 * @param {string} label
 * @param {string} csvValues  - comma-separated list values (no spaces around commas)
 * @param {boolean} [allowBlank]
 */
function addSummaryRow(ws, label, csvValues, allowBlank = false) {
	const row = ws.addRow(new Array(COL_COUNT).fill(''));
	ws.mergeCells(row.number, 1, row.number, 2);
	ws.mergeCells(row.number, 3, row.number, 7);

	const labelCell = row.getCell(1);
	labelCell.value = label;
	labelCell.font = { bold: true, size: 10 };
	labelCell.fill = solidFill('FFF0F0F0');
	labelCell.alignment = { vertical: 'middle', indent: 1 };
	labelCell.border = allBorders();

	const valueCell = row.getCell(3);
	valueCell.fill = solidFill('FFFFFFFF');
	valueCell.alignment = { vertical: 'middle', indent: 1 };
	valueCell.border = allBorders();
	/** @type {ExcelDataValidation} */
	valueCell.dataValidation = {
		type: 'list',
		allowBlank,
		formulae: [`"${csvValues}"`],
		showErrorMessage: false
	};
	row.height = 20;
}

/**
 * A single label | free-text row (italic grey placeholder).
 * @param {ExcelWorksheet} ws
 * @param {string} label
 */
function addSummaryTextRow(ws, label) {
	const row = ws.addRow(new Array(COL_COUNT).fill(''));
	ws.mergeCells(row.number, 1, row.number, 2);
	ws.mergeCells(row.number, 3, row.number, 7);

	const labelCell = row.getCell(1);
	labelCell.value = label;
	labelCell.font = { bold: true, size: 10 };
	labelCell.fill = solidFill('FFF0F0F0');
	labelCell.alignment = { vertical: 'top', indent: 1 };
	labelCell.border = allBorders();

	const valueCell = row.getCell(3);
	valueCell.value = 'Please fill in summary';
	valueCell.font = { italic: true, size: 10, color: { argb: 'FFAAAAAA' } };
	valueCell.fill = solidFill('FFFFFFFF');
	valueCell.alignment = { vertical: 'top', wrapText: true, indent: 1 };
	valueCell.border = allBorders();
	row.height = 60;
}

/**
 * @param {ExcelWorksheet} ws
 * @returns {SynthesisRows}
 */
function addSummarySection(ws) {
	ws.addRow([]);

	// Section header
	const headerRow = ws.addRow(new Array(COL_COUNT).fill(''));
	ws.mergeCells(headerRow.number, 1, headerRow.number, COL_COUNT);
	const headerCell = headerRow.getCell(1);
	headerCell.value = 'SYNTHESIS & CONCLUSION';
	headerCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
	headerCell.fill = solidFill('FF404040');
	headerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
	headerRow.height = 22;

	ws.addRow([]);

	addSummaryRow(ws, 'Primary Hypothesis', 'H1,H2,H3,H4,H5');
	const primaryHypRow = ws.lastRow?.number ?? 0;
	addSummaryRow(ws, 'Secondary Hypothesis (if any)', 'H1,H2,H3,H4,H5', true);
	const secondaryHypRow = ws.lastRow?.number ?? 0;
	addSummaryRow(ws, 'Plausibility Judgement', 'Very likely,Likely,Plausible,Unlikely,Very unlikely');
	const plausibilityRow = ws.lastRow?.number ?? 0;
	addSummaryTextRow(ws, 'Summary');
	const summaryRow = ws.lastRow?.number ?? 0;
	addSummaryRow(ws, 'Triangulation Strength', 'Strong,Moderate,Weak');
	const triangulationRow = ws.lastRow?.number ?? 0;
	addSummaryRow(ws, 'Chosen Conclusion', 'C1: Strong Interaction,C2: Limited or indirect Interaction,C3: No interaction,Inconclusive,Unassessed');
	const conclusionRow = ws.lastRow?.number ?? 0;

	return { primaryHypRow, secondaryHypRow, plausibilityRow, summaryRow, triangulationRow, conclusionRow };
}

// ── Landing / summary page ─────────────────────────────────────────────────────

/** Column widths for the landing page (8 columns) */
const LANDING_COL_WIDTHS = [30, 22, 22, 32, 42, 22, 28, 44];

/**
 * Fill the pre-created landing worksheet with a cross-sheet summary.
 * @param {ExcelWorksheet} ws
 * @param {Record<string, any>} uoaRow
 * @param {SheetMeta[]} sheetMeta
 */
function addLandingPage(ws, uoaRow, sheetMeta) {
	const uoaId = String(uoaRow['uoa'] ?? 'unknown');

	// Column widths
	LANDING_COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

	// ── Title row ──
	const titleRow = ws.addRow(new Array(8).fill(''));
	ws.mergeCells(titleRow.number, 1, titleRow.number, 8);
	const titleCell = titleRow.getCell(1);
	titleCell.value = `UOA Summary  —  ${uoaId}`;
	titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
	titleCell.fill = solidFill('FF1F4E79');
	titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
	titleRow.height = 26;

	// ── "Systems and outcomes" section header ──
	const secRow = ws.addRow(new Array(8).fill(''));
	ws.mergeCells(secRow.number, 1, secRow.number, 8);
	const secCell = secRow.getCell(1);
	secCell.value = 'Systems and outcomes';
	secCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
	secCell.fill = solidFill('FF7030A0');
	secCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
	secRow.height = 20;

	// ── Column headers ──
	const colHeaders = [
		'System',
		'Chosen Most Likely Hypothesis',
		'Chosen Secondary Hypothesis (if any)',
		'Conclusion',
		'Conclusion summary',
		'Plausibility judgement',
		'Strength of evidence triangulation',
		'Flagged Factors'
	];
	const colHeaderRow = ws.addRow(colHeaders);
	colHeaderRow.eachCell(/** @param {ExcelCell} cell */ (cell) => {
		cell.font = { bold: true, size: 10 };
		cell.fill = solidFill('FFF2F2F2');
		cell.border = allBorders('FFAAAAAA');
		cell.alignment = { vertical: 'middle', wrapText: true };
	});
	colHeaderRow.height = 30;

	// ── Per-system blocks ──
	for (const { sheetName, system, synthesisRows } of sheetMeta) {
		const factors = Array.isArray(system.factors) ? system.factors : [];
		if (factors.length === 0) continue;

		// Excel formula sheet reference — always single-quote, escape internal quotes
		const safeRef = `'${sheetName.replace(/'/g, "''")}'`;

		const startDataRow = ws.rowCount + 1;

		// One row per factor for the Flagged Factors column
		for (const factor of factors) {
			const factorPath = `${system.id}.${factor.id}`;
			const flagN = Number(uoaRow[`${factorPath}.flag_n`] ?? 0);
			const noFlagN = Number(uoaRow[`${factorPath}.noflag_n`] ?? 0);
			const missingN = Number(uoaRow[`${factorPath}.missing_n`] ?? 0);
			const total = flagN + noFlagN + missingN;
			const status = flagN > 0 ? 'FLAGGED' : total > 0 ? 'OK' : 'No data';
			const factorText = `${factor.label ?? factor.id}  [${status}  ↑${flagN} ✓${noFlagN} ?${missingN}]`;

			const row = ws.addRow(new Array(8).fill(''));
			const factorCell = row.getCell(8);
			factorCell.value = factorText;
			factorCell.font = { size: 10, color: { argb: flagN > 0 ? 'FFCC0000' : 'FF006400' } };
			factorCell.fill = solidFill('FFFAFAFA');
			factorCell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
			factorCell.border = allBorders();
			row.height = 18;
		}

		const endDataRow = ws.rowCount;

		// Col A: system name (merged across all factor rows)
		if (factors.length > 1) {
			ws.mergeCells(startDataRow, 1, endDataRow, 1);
		}
		const sysCell = ws.getCell(startDataRow, 1);
		sysCell.value = system.label ?? system.id;
		sysCell.font = { bold: true, size: 11 };
		sysCell.fill = solidFill('FFE8D5F5');
		sysCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
		sysCell.border = allBorders();

		// Cols B–G: formula cells referencing system sheet synthesis rows (all col C on that sheet)
		/** @type {Array<{col: number, refRow: number}>} */
		const formulaMap = [
			{ col: 2, refRow: synthesisRows.primaryHypRow },
			{ col: 3, refRow: synthesisRows.secondaryHypRow },
			{ col: 4, refRow: synthesisRows.conclusionRow },
			{ col: 5, refRow: synthesisRows.summaryRow },
			{ col: 6, refRow: synthesisRows.plausibilityRow },
			{ col: 7, refRow: synthesisRows.triangulationRow }
		];

		for (const { col, refRow } of formulaMap) {
			if (factors.length > 1) {
				ws.mergeCells(startDataRow, col, endDataRow, col);
			}
			const cell = ws.getCell(startDataRow, col);
			cell.value = { formula: `=${safeRef}!C${refRow}` };
			cell.fill = solidFill('FFFDF5FF');
			cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
			cell.border = allBorders();
		}
	}
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Build and download a deep-dive Excel workbook for a single unit of analysis.
 *
 * @param {Record<string, any>} uoaRow   - one flagged result row (from flagData output)
 * @param {Record<string, any>} indicatorsJson - full parsed indicators.json
 * @param {string}             [filename]     - download filename (defaults to deepdive_{uoa}.xlsx)
 */
export async function downloadDeepDive(uoaRow, indicatorsJson, filename) {
	const uoaId = uoaRow['uoa'] ?? 'unknown';
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'ANA App';
	workbook.created = new Date();

	// Landing page created first so it becomes the first tab
	const landingWs = workbook.addWorksheet('Summary');

	/** @type {SheetMeta[]} */
	const sheetMeta = [];

	for (const system of indicatorsJson.systems ?? []) {
		if (!system || !Array.isArray(system.factors)) continue;

		// Excel sheet names: max 31 chars, no special characters
		const rawName = String(system.label ?? system.id);
		const sheetName = rawName.slice(0, 31).replace(/[\\/*?:[\]]/g, '_');

		const ws = workbook.addWorksheet(sheetName);

		// Apply column widths
		COL_WIDTHS.forEach((w, i) => {
			ws.getColumn(i + 1).width = w;
		});

		addSystemHeader(ws, rawName, uoaId);
		ws.addRow([]); // blank row after system header

		for (const factor of system.factors) {
			if (!factor) continue;
			const factorPath = `${system.id}.${factor.id}`;
			const factorFlagN = Number(uoaRow[`${factorPath}.flag_n`] ?? 0);
			const factorNoFlagN = Number(uoaRow[`${factorPath}.noflag_n`] ?? 0);
			const factorMissingN = Number(uoaRow[`${factorPath}.missing_n`] ?? 0);

			addFactorRow(ws, factor.label ?? factor.id, factorFlagN, factorNoFlagN, factorMissingN);

			const subs = Array.isArray(factor.sub_factors) ? factor.sub_factors : [];
			for (const sub of subs) {
				if (!sub || !Array.isArray(sub.indicators) || sub.indicators.length === 0) continue;

				const subPath = `${system.id}.${factor.id}.${sub.id}`;
				const subFlagN = Number(uoaRow[`${subPath}.flag_n`] ?? 0);
				const subNoFlagN = Number(uoaRow[`${subPath}.noflag_n`] ?? 0);
				const subMissingN = Number(uoaRow[`${subPath}.missing_n`] ?? 0);

				addSubfactorRow(ws, sub.label ?? sub.id, subFlagN, subNoFlagN, subMissingN);
				addTableHeaderRow(ws);

				for (const ind of sub.indicators) {
					if (!ind || !ind.indicator) continue;
					const id = ind.indicator;
					const value = uoaRow[id] ?? null;
					const flagLabelStr = String(uoaRow[`${id}_flag_label`] ?? 'no_data');

					addIndicatorRow(ws, {
						id,
						label: ind.indicator_label ?? null,
						metric: ind.metric ?? null,
						value,
						flagLabelStr,
						an: ind.thresholds?.an ?? null,
						direction: ind.above_or_below ?? null
					});
				}

				ws.addRow([]); // blank row after each sub-factor block
			}

			ws.addRow([]); // blank row after each factor block
		}

		const synthesisRows = addSummarySection(ws);
		sheetMeta.push({ sheetName, system, synthesisRows });
	}

	addLandingPage(landingWs, uoaRow, sheetMeta);

	const buffer = await workbook.xlsx.writeBuffer();
	const blob = new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename ?? `deepdive_${uoaId}.xlsx`;
	a.click();
	URL.revokeObjectURL(url);
}
