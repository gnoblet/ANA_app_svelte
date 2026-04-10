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
	<title>ANA — Acute Needs Analysis</title>
</svelte:head>

<!-- Previous results banner -->
{#if hasPreviousResults && !validationPassed}
	<div role="alert" class="alert bg-success/10 border-success/20 mb-5 flex items-center justify-between gap-4 border">
		<div class="flex items-start gap-3">
			<!-- checkmark icon -->
			<svg xmlns="http://www.w3.org/2000/svg" class="text-success mt-0.5 size-5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
			</svg>
			<div>
				<p class="text-success-content text-sm font-semibold">Previous results available</p>
				<p class="text-base-content/60 text-xs">
					Results from your last session are still saved. Upload a new file to reprocess, or continue exploring.
				</p>
				{#if flagStore.filename || flagStore.uploadedAt}
					<p class="text-base-content/50 mt-0.5 text-xs">
						{#if flagStore.filename}<span class="font-medium">{flagStore.filename}</span>{/if}
						{#if flagStore.uploadedAt}
							&mdash; {new Date(flagStore.uploadedAt).toLocaleString()}
						{/if}
					</p>
				{/if}
			</div>
		</div>
		<NavButton href={resolve('/results')} label="View Results" direction="forward" variant="primary" size="sm" />
	</div>
{/if}

<!-- Upload zone -->
<section class="rounded-box bg-base-200/60 border-base-300 border px-6 py-8 sm:px-10 sm:py-10">
	<div class="mx-auto max-w-lg text-center">
		<h1 class="text-2xl font-bold tracking-tight">Upload your dataset</h1>
		<p class="text-base-content/60 mt-1 text-sm">
			CSV with a <code class="text-base-content/80">uoa</code> column and indicator columns (e.g.
			<code class="text-base-content/80">IND001</code>). Valid data is classified and flagged automatically.
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
					<p class="text-error text-sm font-semibold">Parsing errors</p>
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
					<p class="text-error text-sm font-semibold">Processing error</p>
					<p class="text-error mt-0.5 text-sm">{pipelineError}</p>
				</div>
			{/if}
		</div>
	</div>
</section>

<!-- Post-processing CTA — shown only after a successful run -->
{#if validationPassed || hasPreviousResults}
	<div class="mt-4 flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-5 py-3.5">
		<p class="text-sm font-medium">Data processed — ready to explore.</p>
		<div class="flex items-center gap-2">
			<NavButton href={resolve('/results')} label="View Results" direction="forward" variant="primary" size="sm" />
			<NavButton href={resolve('/detailed')} label="Detailed" direction="forward" size="sm" />
			<NavButton href={resolve('/download')} label="Downloads" direction="forward" size="sm" />
		</div>
	</div>
{/if}

<!-- How it works -->
<div class="mt-8">
	<!-- Inline caveat note — subdued, above the step descriptions -->
	<div class="alert alert-info mb-4 py-3">
		<svg xmlns="http://www.w3.org/2000/svg" class="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
		</svg>
		<span class="text-xs">
			<strong>The preliminary flag is not final.</strong> It is a data-driven pre-screening result and a starting point for in-depth analysis — not a conclusion. Each UOA must go through a full deep-dive before drawing judgements.
		</span>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="card bg-base-100 border-base-300 border shadow-sm">
			<div class="card-body gap-1 py-5">
				<p class="text-primary font-mono text-xs font-bold uppercase tracking-widest">Step 1</p>
				<h3 class="font-semibold">Upload your CSV</h3>
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
							indicator ID (e.g. <code>IND001</code>, <code>IND002</code>). If misspelled, these
							columns are ignored for flagging.
						</li>
						<li>
							<span class="text-base-content font-semibold">Metadata columns:</span> any extra columns
							(e.g. <code>region</code>, <code>partner</code>) are carried through and can be used to
							filter results.
						</li>
						<li>
							<span class="text-base-content font-semibold">P-codes:</span> if UOA values are admin
							p-codes (e.g. <code>SOM001</code>), a choropleth map will be generated automatically.
						</li>
						<li>
							Values must be numeric or empty — no special characters or formatted strings.
						</li>
					</ul>
				</details>
			</div>
		</div>
		<div class="card bg-base-100 border-base-300 items-start border shadow-sm">
			<div class="card-body gap-1 py-5">
				<p class="text-primary font-mono text-xs font-bold uppercase tracking-widest">Step 2</p>
				<h3 class="font-semibold">Automatic flagging</h3>
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
		<div class="card bg-base-100 border-base-300 border shadow-sm">
			<div class="card-body gap-1 py-5">
				<p class="text-primary font-mono text-xs font-bold uppercase tracking-widest">Step 3</p>
				<h3 class="font-semibold">Explore &amp; export</h3>
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
