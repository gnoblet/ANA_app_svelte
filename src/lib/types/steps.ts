import { resolve } from '$app/paths';

export type AppRoute = Parameters<typeof resolve>[0];

export type StepDetailSection = {
	label: string;
	body: string;
	route?: AppRoute;
};

export type Step = {
	title: string;
	desc: string;
	detail: {
		sections: StepDetailSection[];
		tip: string | null;
	};
};

export const steps: Step[] = [
	{
		title: 'Upload your CSV',
		desc: 'A uoa column for units of analysis, plus indicator columns (e.g. IND001). Metadata columns are carried through automatically.',
		detail: {
			sections: [
				{
					label: 'Required column',
					body: 'A uoa column with a unique identifier per row — district name, p-code, or any string that identifies the unit of analysis.'
				},
				{
					label: 'Indicator columns',
					body: 'Named with the indicator ID (e.g. IND001, IND002). Misspelled columns are silently ignored for flagging. To find the full list of indicator IDs, go to the Reference tab.'
				},
				{
					label: 'Metadata columns',
					body: 'Any extra columns (region, partner, etc.) are carried through automatically and available as filters in results views.'
				},
				{
					label: 'P-codes',
					body: 'If UOA values are admin p-codes (e.g. SOM001, SOM001001), a choropleth map is generated automatically alongside the heatmap.'
				},
				{
					label: 'Values',
					body: 'Must be numeric or empty. No formatted strings, currency symbols, or special characters. Invalid values are treated as missing.'
				}
			],
			tip: 'Find all indicator IDs in the Reference tab.'
		}
	},
	{
		title: 'Automatic flagging',
		desc: 'Values are validated and compared against alert thresholds. Results roll up from indicators → factors → systems → preliminary flag.',
		detail: {
			sections: [
				{
					label: 'Sanity validation',
					body: 'Each value is checked against per-indicator rules (e.g. rates must be 0–1, counts cannot be negative). Failing values are treated as missing, not dropped.'
				},
				{
					label: 'Indicator flagging',
					body: 'Each valid value is compared against an alert (AN) threshold. Exceeding it flags the indicator for that UOA.'
				},
				{
					label: 'Roll-up logic',
					body: 'Flags aggregate up: indicators → subfactors → factors → systems. A minimum evidence rule applies at each level — too few valid indicators yields "Insufficient evidence" rather than a flag.'
				},
				{
					label: 'Preliminary classification',
					body: 'Each UOA receives one of: EM · ROEM · Acute Needs · No Acute Needs · Insufficient Evidence · No Data — based on the system-level roll-up.'
				}
			],
			tip: null
		}
	},
	{
		title: 'Explore & export',
		desc: 'Browse results as a heatmap, per-indicator strips, or coverage view. Export as CSV, XLSX, or per-UOA deep-dive workbooks.',
		detail: {
			sections: [
				{
					label: 'Results',
					body: 'Overview of preliminary classifications per UOA — donut breakdown, system coverage bars, ranking table, and an interactive heatmap. Filterable by UOA, classification, or metadata.',
					route: '/results'
				},
				{
					label: 'Detailed',
					body: "Per-indicator beeswarm strips showing every UOA's value relative to the alert threshold. Filterable by system, factor, and UOA.",
					route: '/detailed'
				},
				{
					label: 'Coverage',
					body: 'Circle-packing view of your uploaded data against the full indicator framework. Quickly shows which systems and factors have data and which are missing.',
					route: '/coverage'
				},
				{
					label: 'Downloads',
					body: 'Export the full flagged dataset as CSV, JSON, or XLSX. Or generate one pre-filled deep-dive workbook per UOA — delivered as a single ZIP.',
					route: '/download'
				}
			],
			tip: null
		}
	}
];
