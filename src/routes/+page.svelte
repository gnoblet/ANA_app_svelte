<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import CsvUploader from '$lib/components/data/CsvUploader.svelte';
	import ValidatorView from '$lib/components/data/ValidatorView.svelte';
	import NavButton from '$lib/components/ui/NavButton.svelte';
	import { loadIndicatorsIntoStore, indicatorsStore } from '$lib/stores/indicatorsStore.svelte';
	import { flagStore, clearFlagResult } from '$lib/stores/flagStore.svelte';
	import {
		validatorStore,
		saveValidatorState,
		clearValidatorState
	} from '$lib/stores/validatorStore.svelte';
	import { adminFeaturesStore, clearAdminFeatures } from '$lib/stores/adminFeaturesStore.svelte';
	import { validateCsv, type ValidationResult } from '$lib/engine/validator';
	import { runPipeline } from '$lib/engine/pipeline';

	interface ParseError {
		message: string;
	}

	let lastHeader: string[] = $state([]);
	let lastRows: Record<string, unknown>[] = $state([]);
	let validationResult: ValidationResult | null = $state(null);
	let parseErrors: ParseError[] | ParseError | null = $state(null);
	let filename: string | null = $state(null);
	let isValidating = $state(false);
	let pipelineError = $state<string | null>(null);
	let validationPassed = $state(false);

	const indicatorMap = $derived(indicatorsStore.indicatorMap);

	// True when there are stored results but the validator is idle (cleared after flagging).
	const hasPreviousResults = $derived(
		flagStore.flaggedResult !== null &&
			flagStore.flaggedResult.length > 0 &&
			!validatorStore.validationResult
	);

	onMount(() => {
		loadIndicatorsIntoStore();
		lastHeader = validatorStore.lastHeader ?? [];
		lastRows = validatorStore.lastRows ?? [];
		validationResult = (validatorStore.validationResult as ValidationResult | null) ?? null;
		parseErrors = (validatorStore.parseErrors as ParseError[] | ParseError | null) ?? null;
		filename = validatorStore.filename ?? null;
	});

	function onParsed(e: CustomEvent) {
		parseErrors = e.detail?.errors?.length ? e.detail.errors : null;
		lastHeader = e.detail.header ?? [];
		lastRows = e.detail.rows ?? [];
		filename = e.detail.filename ?? null;
		validationPassed = false;

		// New file uploaded — clear any previous flagging run.
		// Admin features are only cleared if in error state; cached boundaries are reused.
		clearFlagResult();
		if (adminFeaturesStore.fetchState === 'error') clearAdminFeatures();

		isValidating = true;
		const startTime = Date.now();

		setTimeout(() => {
			validationResult = validateCsv(lastHeader, lastRows, indicatorMap);
			const elapsed = Date.now() - startTime;
			const remaining = Math.max(0, 1000 - elapsed);

			const finish = async () => {
				isValidating = false;
				pipelineError = null;
				saveValidatorState(
					lastHeader,
					lastRows,
					validationResult as Record<string, unknown> | null,
					parseErrors,
					filename
				);
				if (validationResult?.ok && validationResult.numericObjects?.length) {
					try {
						await runPipeline({
							header: lastHeader,
							rows: lastRows,
							filename,
							indicatorMap,
							indicatorsJson: indicatorsStore.indicatorsJson
						});
					} catch (e) {
						pipelineError = e instanceof Error ? e.message : String(e);
					}
					validationPassed = true;
				}
			};

			if (remaining > 0) {
				setTimeout(finish, remaining);
			} else {
				finish();
			}
		}, 0);
	}

	function onParseError(e: CustomEvent) {
		parseErrors = e.detail ?? { message: 'Unknown parse error' };
		validationResult = null;
		lastHeader = [];
		lastRows = [];
		filename = null;
	}

	function clearAll() {
		validationResult = null;
		lastHeader = [];
		lastRows = [];
		parseErrors = null;
		filename = null;
		pipelineError = null;
		validationPassed = false;
		clearValidatorState();
		clearFlagResult();
		clearAdminFeatures();
	}
</script>

<svelte:head>
	<title>ANA App</title>
</svelte:head>

{#if hasPreviousResults && !validationPassed}
	<div role="alert" class="alert alert-success mb-4 flex items-center justify-between">
		<div>
			<p class="font-semibold">Previous results available</p>
			<p class="text-sm">
				Your last dataset was processed successfully. The validator has been cleared, but results
				are still saved. To analyse new data, upload a new file below.
			</p>
			{#if flagStore.filename || flagStore.uploadedAt}
				<p class="text-base-content/70 mt-1 text-xs">
					{#if flagStore.filename}<span class="font-medium">{flagStore.filename}</span>{/if}
					{#if flagStore.uploadedAt}
						— Processed at {new Date(flagStore.uploadedAt).toLocaleString()}
					{/if}
				</p>
			{/if}
		</div>
		<NavButton href={resolve('/results')} label="View Results" direction="forward" />
	</div>
{/if}

<!-- Hero upload section -->
<div class="hero bg-base-200 rounded-box min-h-64">
	<div class="hero-content text-center">
		<div class="max-w-xl">
			<h1 class="mt-8 text-5xl font-bold">ANA Flag App</h1>
			<p class="mt-4 text-xl">
				Upload your ANA data as a CSV. Valid data will be classified automatically and deep-dives
				prepopulated.
			</p>
			<div class="mt-6">
				<CsvUploader
					title="Upload CSV"
					hintText="The CSV must have a header row with a <code>uoa</code> column and indicator columns (e.g. <code>IND001</code>)."
					on:parsed={onParsed}
					on:error={onParseError}
					on:cleared={clearAll}
				/>

				{#if parseErrors}
					<div class="mt-3 text-left">
						<strong class="text-error">Parsing errors:</strong>
						<ul class="text-error mt-1 list-disc pl-5 text-sm">
							{#if Array.isArray(parseErrors)}
								{#each parseErrors as pe (JSON.stringify(pe))}
									<li>{pe.message ?? JSON.stringify(pe)}</li>
								{/each}
							{:else}
								<li>{parseErrors.message ?? JSON.stringify(parseErrors)}</li>
							{/if}
						</ul>
					</div>
				{/if}
				{#if pipelineError}
					<div class="mt-3 text-left">
						<strong class="text-error">Processing error:</strong>
						<p class="text-error mt-1 text-sm">{pipelineError}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

{#if validationPassed || hasPreviousResults}
	<div class="mt-6 flex flex-wrap justify-center gap-3">
		<NavButton href={resolve('/results')} label="Results" direction="forward" variant="primary" />
		<NavButton href={resolve('/detailed')} label="Detailed Results" direction="forward" />
		<NavButton href={resolve('/coverage')} label="Data Coverage" direction="forward" />
		<NavButton href={resolve('/reference')} label="Reference List" direction="forward" />
		<NavButton href={resolve('/download')} label="Downloads" direction="forward" />
	</div>
{/if}

<!-- How it works -->
<div class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
	<div class="card bg-base-100 border-base-300/40 border shadow-sm">
		<div class="card-body gap-1 py-5">
			<p class="text-primary font-bolduppercase font-mono">Step 1</p>
			<h1 class="font-semibold">Upload your CSV</h1>
			<p class="text-base-content/70 text-sm">
				Your file needs a <code>uoa</code> column (unit of analysis) and at least one indicator
				column (e.g. <code>IND001</code>). Metadata columns are carried through automatically.
			</p>
			<details class="mt-2">
				<summary class="text-primary cursor-pointer text-xs font-semibold select-none">
					How to format the CSV
				</summary>
				<ul class="text-base-content/70 mt-2 space-y-1.5 text-xs">
					<li>
						<span class="text-base-content font-semibold">Required:</span> a <code>uoa</code> column with
						a unique identifier per unit of analysis (e.g. district name or p-code).
					</li>
					<li>
						<span class="text-base-content font-semibold">Indicator columns:</span> named with the
						indicator ID (e.g. <code>IND001</code>, <code>IND002</code>). If mispelled, these
						columns are ignored for flagging.
					</li>
					<li>
						<span class="text-base-content font-semibold">Metadata columns:</span> any extra columns
						(e.g. <code>region</code>, <code>partner</code>) are carried through and can be used to
						filter results.
					</li>
					<li>
						<span class="text-base-content font-semibold">P-codes:</span> if UOA values are admin
						p-codes (e.g. <code>SOM001</code>), a choropleth map will be generated automatically
						(see Result tab).
					</li>
					<li>
						Generally, values must be numeric or empty — no special characters or formatted strings.
					</li>
				</ul>
			</details>
		</div>
	</div>
	<div class="card bg-base-100 border-base-300/40 items-start border shadow-sm">
		<div class="card-body gap-1 py-5">
			<p class="text-primary font-mono font-bold uppercase">Step 2</p>
			<h1 class="font-semibold">Automatic flagging</h1>
			<p class="text-base-content/70 text-sm">
				Each indicator is validated and flagged against reference thresholds. Results are rolled up
				from indicators → factors → systems → preliminary flag.
			</p>
			<details class="mt-2">
				<summary class="text-primary cursor-pointer text-xs font-semibold select-none">
					More info
				</summary>
				<ul class="text-base-content/70 mt-2 space-y-1.5 text-xs">
					<li>
						<span class="text-base-content font-semibold">Validation:</span> sanity checks are applied
						to each indicator value (e.g. counts cannot be negative, rates must be between 0 and 1). Invalid
						values are treated as missing.
					</li>
					<li>
						<span class="text-base-content font-semibold">Indicator flagging:</span> each value is compared
						against an alert threshold. If it exceeds the threshold, the indicator is flagged.
					</li>
					<li>
						<span class="text-base-content font-semibold">Roll-up logic:</span> flags are aggregated from
						indicators → subfactors → factors → systems. A minimum evidence threshold applies at each
						level — insufficient data is tracked separately.
					</li>
					<li>
						<span class="text-base-content font-semibold">Preliminary flag:</span> each UOA receives a
						classification (EM, ROEM, ACUTE, No Acute Needs, Insufficient Evidence, or No Data) based
						on the system-level roll-up.
					</li>
				</ul>
			</details>
		</div>
	</div>
	<div class="card bg-base-100 border-base-300/40 border shadow-sm">
		<div class="card-body gap-1 py-5">
			<p class="text-primary font-mono font-bold uppercase">Step 3</p>
			<h1 class="font-semibold">Explore &amp; export</h1>
			<p class="text-base-content/70 text-sm">
				Visualize results by system, factor, and UOA. Download flagged data as CSV, JSON, or XLSX —
				or generate pre-filled deep-dive packages per unit of analysis.
			</p>
			<details class="mt-2">
				<summary class="text-primary cursor-pointer text-xs font-semibold select-none">
					What's inside
				</summary>
				<ul class="text-base-content/70 mt-2 space-y-2 text-xs">
					<li>
						<span class="text-base-content font-semibold">Results</span> — Overview of preliminary classifications
						per UOA: donut breakdown, system coverage bars, ranking table, and an interactive heatmap.
						Filter by UOA, classification, or metadata columns.
					</li>
					<li>
						<span class="text-base-content font-semibold">Detailed results</span> — Per-indicator beeswarm
						strips showing each UOA's value against the alert threshold. Filterable by system, factor,
						and UOA.
					</li>
					<li>
						<span class="text-base-content font-semibold">Data coverage</span> — Circle-packing view of
						your uploaded data against the full indicator framework. Useful to quickly see which systems
						and factors have data.
					</li>
					<li>
						<span class="text-base-content font-semibold">Downloads</span> — Export the full flagged dataset
						or generate one deep-dive workbook per UOA, pre-filled with indicator values and classification
						context.
					</li>
				</ul>
			</details>
		</div>
	</div>
</div>
<!-- Preliminary flag note -->
<div class="alert alert-warning mt-4">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="size-5 shrink-0"
		viewBox="0 0 20 20"
		fill="currentColor"
	>
		<path
			fill-rule="evenodd"
			d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
			clip-rule="evenodd"
		/>
	</svg>
	<span class="text-sm">
		<strong>The preliminary flag is not final (preliminary it says!).</strong> It is a data-driven pre-screening
		result, intended as a starting point for in-depth analysis. Each UOA receives one preliminary flag
		— this is a pre-requisite for generating pre-populated deep-dive workbooks, but going through deep-dives
		is required before drawing conclusions.
	</span>
</div>

<!-- Validation result -->
<ValidatorView
	result={validationResult}
	header={lastHeader}
	rows={lastRows}
	loading={isValidating}
/>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}
</style>
