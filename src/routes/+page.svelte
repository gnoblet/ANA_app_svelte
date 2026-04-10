<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import CsvUploader from '$lib/components/data/CsvUploader.svelte';
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
	let formatModal = $state<HTMLDialogElement | null>(null);
	let stepsModal = $state<HTMLDialogElement | null>(null);
	let activeStep = $state(0);

	const indicatorMap = $derived(indicatorsStore.indicatorMap);

	const hasPreviousResults = $derived(
		flagStore.flaggedResult !== null &&
			flagStore.flaggedResult.length > 0 &&
			!validatorStore.validationResult
	);

	const steps = [
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
						body: 'Overview of preliminary classifications per UOA — donut breakdown, system coverage bars, ranking table, and an interactive heatmap. Filterable by UOA, classification, or metadata.'
					},
					{
						label: 'Detailed',
						body: "Per-indicator beeswarm strips showing every UOA's value relative to the alert threshold. Filterable by system, factor, and UOA."
					},
					{
						label: 'Coverage',
						body: 'Circle-packing view of your uploaded data against the full indicator framework. Quickly shows which systems and factors have data and which are missing.'
					},
					{
						label: 'Downloads',
						body: 'Export the full flagged dataset as CSV, JSON, or XLSX. Or generate one pre-filled deep-dive workbook per UOA — delivered as a single ZIP.'
					}
				],
				tip: null
			}
		}
	];

	function openStep(i: number) {
		activeStep = i;
		stepsModal?.showModal();
	}

	onMount(() => {
		loadIndicatorsIntoStore();
		lastHeader = validatorStore.lastHeader ?? [];
		lastRows = validatorStore.lastRows ?? [];
		validationResult = (validatorStore.validationResult as ValidationResult | null) ?? null;
		parseErrors = (validatorStore.parseErrors as ParseError[] | ParseError | null) ?? null;
		filename = validatorStore.filename ?? null;
	});

	function onParsed(detail: {
		errors?: unknown[];
		header?: string[];
		rows?: unknown[];
		fileName?: string;
	}) {
		parseErrors = detail.errors?.length ? (detail.errors as ParseError[]) : null;
		lastHeader = detail.header ?? [];
		lastRows = (detail.rows ?? []) as Record<string, unknown>[];
		filename = detail.fileName ?? null;
		validationPassed = false;

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

			if (remaining > 0) setTimeout(finish, remaining);
			else finish();
		}, 0);
	}

	function onParseError(detail: { message: string; errors?: unknown[] }) {
		parseErrors = detail ?? { message: 'Unknown parse error' };
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
	<div
		role="alert"
		class="alert bg-success/10 border-success/20 mb-6 flex items-center justify-between gap-4 border"
	>
		<div class="flex items-start gap-3">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="text-success mt-0.5 size-5 shrink-0"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
					clip-rule="evenodd"
				/>
			</svg>
			<div>
				<p class="text-success-content text-sm font-semibold">Previous results available</p>
				<p class="text-base-content/60 text-xs">
					Results from your last session are still saved. Upload a new file to reprocess, or
					continue exploring.
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
		<NavButton
			href={resolve('/results')}
			label="View Results"
			direction="forward"
			variant="primary"
			size="sm"
		/>
	</div>
{/if}

<!-- Hero: 3/2 column split (left wider) -->
<div class="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-30">
	<!-- Left: brand + steps (3 cols) -->
	<div class="lg:col-span-2 lg:pt-1">
		<!-- Badge -->
		<div
			class="border-primary/25 bg-primary/8 mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
		>
			<span class="bg-primary size-1.5 rounded-full"></span>
			<span class="text-primary text-xs font-semibold tracking-widest uppercase"
				>Data flagging tool</span
			>
		</div>

		<!-- Headline -->
		<h1 class="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
			Screen humanitarian<br />data for acute needs
		</h1>
		<p class="text-base-content/60 mt-3 leading-relaxed">
			Upload a CSV of indicator values. The tool validates, flags, and classifies each unit of
			analysis against reference thresholds — automatically.
		</p>

		<!-- Workflow steps -->
		<ol class="mt-8 space-y-6">
			{#each steps as step, i (i)}
				<li class="flex items-start gap-4">
					<span
						class="bg-primary/10 text-primary ring-primary/20 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1"
					>
						{i + 1}
					</span>
					<div class="flex-1 pt-0.5">
						<div class="flex items-baseline justify-between gap-3">
							<p class="font-semibold">{step.title}</p>
							<button
								class="text-primary/70 hover:text-primary shrink-0 cursor-pointer text-xs font-medium underline underline-offset-2 transition-colors duration-150"
								onclick={() => openStep(i)}
							>
								More info
							</button>
						</div>
						<p class="text-base-content/60 mt-0.5 text-sm">{step.desc}</p>
					</div>
				</li>
			{/each}
		</ol>

		<!-- Caveat note -->
		<div class="border-info/15 bg-info/8 mt-8 flex items-start gap-3 rounded-lg border px-4 py-3.5">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="text-info mt-0.5 size-4 shrink-0"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
					clip-rule="evenodd"
				/>
			</svg>
			<p class="text-base-content/70 text-xs leading-relaxed">
				<strong>The preliminary flag is not final.</strong> It is a data-driven pre-screening and a starting
				point for analysis — not a conclusion. Each UOA requires a full deep-dive before drawing judgements.
			</p>
		</div>
	</div>

	<!-- Right: upload card (2 cols) -->
	<div class="lg:col-span-3">
		<div class="card bg-base-100 border-base-300 border shadow-sm">
			<div class="card-body gap-0">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h2 class="text-lg font-semibold">Upload your dataset</h2>
						<p class="text-base-content/55 mt-1 text-sm">
							CSV with a <code class="text-base-content/80">uoa</code> column and indicator columns.
						</p>
					</div>
					<button
						class="btn btn-ghost btn-xs text-base-content/40 hover:text-base-content shrink-0 cursor-pointer gap-1"
						onclick={() => formatModal?.showModal()}
						title="CSV format reference"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="size-3.5"
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
						>
							<path
								fill-rule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
								clip-rule="evenodd"
							/>
						</svg>
						Format
					</button>
				</div>

				<div class="mt-5">
					<CsvUploader
						hintText="Must have a <code>uoa</code> column and indicator columns (e.g. <code>IND001</code>)."
						onparsed={onParsed}
						onerror={onParseError}
						oncleared={clearAll}
					/>
				</div>

				<!-- Parse / pipeline errors -->
				{#if parseErrors}
					<div class="bg-error/8 border-error/15 mt-4 rounded-lg border px-4 py-3">
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
					<div class="bg-error/8 border-error/15 mt-4 rounded-lg border px-4 py-3">
						<p class="text-error text-sm font-semibold">Processing error</p>
						<p class="text-error mt-0.5 text-sm">{pipelineError}</p>
					</div>
				{/if}

				<!-- Compact validation status -->
				{#if isValidating}
					<div class="mt-4 flex items-center gap-2.5 text-sm">
						<span class="loading loading-spinner loading-xs text-primary"></span>
						<span class="text-base-content/55">Validating…</span>
					</div>
				{:else if validationResult && !validationResult.ok}
					<div
						class="border-error/20 bg-error/6 mt-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
					>
						<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
							<span class="badge badge-error badge-sm">Validation failed</span>
							<span class="text-base-content/55 text-xs">
								{#if validationResult.headerErrors?.length}
									{validationResult.headerErrors.length} header error{validationResult.headerErrors
										.length !== 1
										? 's'
										: ''}
									{#if validationResult.cellErrors?.length || validationResult.warnings?.length}
										·
									{/if}
								{/if}
								{#if validationResult.cellErrors?.length}
									{validationResult.cellErrors.length} cell error{validationResult.cellErrors
										.length !== 1
										? 's'
										: ''}
									{#if validationResult.warnings?.length}
										·
									{/if}
								{/if}
								{#if validationResult.warnings?.length}
									{validationResult.warnings.length} warning{validationResult.warnings.length !== 1
										? 's'
										: ''}
								{/if}
							</span>
						</div>
						<a
							href={resolve('/validate')}
							class="btn btn-error btn-outline btn-xs shrink-0 cursor-pointer gap-1"
						>
							View details
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="size-3"
								viewBox="0 0 20 20"
								fill="currentColor"
								aria-hidden="true"
							>
								<path
									fill-rule="evenodd"
									d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
									clip-rule="evenodd"
								/>
							</svg>
						</a>
					</div>
				{:else if validationResult?.ok}
					<div class="mt-4 flex items-center gap-2.5">
						<span class="badge badge-success badge-sm">Validation passed</span>
						<span class="text-base-content/50 text-xs">
							{validationResult.numericObjects?.length ?? 0} rows · {lastHeader.length} columns
						</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Post-processing CTA -->
		{#if validationPassed || hasPreviousResults}
			<div
				class="border-primary/20 bg-primary/5 mt-3 flex items-center justify-between gap-4 rounded-lg border px-5 py-3.5"
			>
				<p class="text-sm font-medium">Data processed — ready to explore.</p>
				<div class="flex items-center gap-2">
					<NavButton
						href={resolve('/results')}
						label="View Results"
						direction="forward"
						variant="primary"
						size="sm"
					/>
					<NavButton href={resolve('/detailed')} label="Detailed" direction="forward" size="sm" />
					<NavButton href={resolve('/download')} label="Downloads" direction="forward" size="sm" />
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- ── Modals ──────────────────────────────────────────────────────────────── -->

<!-- Format guide: CSV structure only -->
<dialog bind:this={formatModal} class="modal">
	<div class="modal-box max-w-lg">
		<form method="dialog">
			<button
				class="btn btn-sm btn-circle btn-ghost absolute top-3 right-3 cursor-pointer"
				aria-label="Close">✕</button
			>
		</form>
		<h3 class="text-lg font-bold">CSV format guide</h3>
		<p class="text-base-content/55 mt-1 text-sm">How to structure your file before uploading.</p>

		<div class="mt-5 space-y-3">
			<div class="border-base-300 bg-base-200/40 rounded-lg border px-4 py-3.5">
				<p class="text-base-content text-sm font-semibold">
					uoa column <span class="text-error ml-1 text-xs font-normal">required</span>
				</p>
				<p class="text-base-content/65 mt-1 text-sm">
					A column named exactly <code>uoa</code> with a unique identifier per row — district name, p-code,
					or any string that identifies the unit of analysis.
				</p>
			</div>
			<div class="border-base-300 bg-base-200/40 rounded-lg border px-4 py-3.5">
				<p class="text-base-content text-sm font-semibold">Indicator columns</p>
				<p class="text-base-content/65 mt-1 text-sm">
					Named with the indicator ID (e.g. <code>IND001</code>, <code>IND002</code>). Unrecognised
					column names are silently ignored for flagging.
				</p>
			</div>
			<div class="border-base-300 bg-base-200/40 rounded-lg border px-4 py-3.5">
				<p class="text-base-content text-sm font-semibold">
					Metadata columns <span class="text-base-content/40 ml-1 text-xs font-normal"
						>optional</span
					>
				</p>
				<p class="text-base-content/65 mt-1 text-sm">
					Any extra columns (e.g. <code>region</code>, <code>partner</code>) are carried through and
					available as filters in results views.
				</p>
			</div>
			<div class="border-base-300 bg-base-200/40 rounded-lg border px-4 py-3.5">
				<p class="text-base-content text-sm font-semibold">Values</p>
				<p class="text-base-content/65 mt-1 text-sm">
					Must be numeric or empty. No formatted strings, units, or special characters. Invalid
					values are treated as missing.
				</p>
			</div>
			<div class="border-base-300 bg-base-200/40 rounded-lg border px-4 py-3.5">
				<p class="text-base-content text-sm font-semibold">
					P-codes <span class="text-base-content/40 ml-1 text-xs font-normal">optional</span>
				</p>
				<p class="text-base-content/65 mt-1 text-sm">
					If <code>uoa</code> values are admin p-codes (e.g. <code>SOM001</code>), a choropleth map
					is generated automatically.
				</p>
			</div>
		</div>

		<div
			class="border-primary/20 bg-primary/6 mt-5 flex items-center gap-2.5 rounded-lg border px-4 py-3"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="text-primary size-4 shrink-0"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
					clip-rule="evenodd"
				/>
			</svg>
			<p class="text-sm">
				For the full list of indicator IDs, see the
				<a
					href={resolve('/reference')}
					class="text-primary font-semibold underline underline-offset-2">Reference</a
				> tab.
			</p>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<!-- Step detail modal (shared, switches content via activeStep) -->
<dialog bind:this={stepsModal} class="modal">
	<div class="modal-box max-w-lg">
		<form method="dialog">
			<button
				class="btn btn-sm btn-circle btn-ghost absolute top-3 right-3 cursor-pointer"
				aria-label="Close">✕</button
			>
		</form>

		<!-- Step nav pills -->
		<div class="mb-5 flex gap-2">
			{#each steps as step, i (i)}
				<button
					class={[
						'cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150',
						activeStep === i
							? 'bg-primary text-primary-content'
							: 'bg-base-200 text-base-content/55 hover:text-base-content'
					].join(' ')}
					onclick={() => (activeStep = i)}
				>
					{i + 1}. {step.title}
				</button>
			{/each}
		</div>

		<h3 class="text-lg font-bold">{steps[activeStep].title}</h3>
		<p class="text-base-content/55 mt-1 text-sm">{steps[activeStep].desc}</p>

		<div class="mt-5 space-y-3">
			{#each steps[activeStep].detail.sections as section (section.label)}
				<div class="border-base-300 bg-base-200/40 rounded-lg border px-4 py-3.5">
					<p class="text-base-content text-sm font-semibold">{section.label}</p>
					<p class="text-base-content/65 mt-1 text-sm">{section.body}</p>
				</div>
			{/each}
		</div>

		{#if steps[activeStep].detail.tip}
			<div
				class="border-primary/20 bg-primary/6 mt-4 flex items-center gap-2.5 rounded-lg border px-4 py-3"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="text-primary size-4 shrink-0"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
						clip-rule="evenodd"
					/>
				</svg>
				<p class="text-sm">
					{steps[activeStep].detail.tip}
					{#if activeStep === 0}
						<a
							href={resolve('/reference')}
							class="text-primary font-semibold underline underline-offset-2">Reference</a
						> tab.
					{/if}
				</p>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}
</style>
