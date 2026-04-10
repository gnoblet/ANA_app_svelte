<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { steps } from '$lib/types/steps';
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
		class="alert bg-success/20 border-success/20 mb-8 flex items-center justify-between gap-4 border"
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
				<p class="font-semibold">Previous results available</p>
				<p class="text-base-content/70 text-xs">
					Results from your last session are still saved. Upload a new file to reprocess, or
					continue exploring.
				</p>
				{#if flagStore.filename || flagStore.uploadedAt}
					<p class="text-base-content/70 mt-0.5 text-xs">
						{#if flagStore.filename}<span class="font-medium">{flagStore.filename}</span>{/if}
						{#if flagStore.uploadedAt}
							&mdash; {new Date(flagStore.uploadedAt).toLocaleString()}
						{/if}
					</p>
				{/if}
			</div>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<NavButton
				href={resolve('/results')}
				label="View Results"
				direction="forward"
				variant="primary"
				size="sm"
			/>
			<NavButton
				href={resolve('/download')}
				label="Download"
				direction="forward"
				variant="outline"
				size="sm"
			/>
			<button
				class="btn btn-ghost btn-outline btn-sm text-base-content/80 hover:text-error hover:bg-error/10 cursor-pointer"
				onclick={clearAll}
				title="Clear saved results"
				aria-label="Clear saved results"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="size-4"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
						clip-rule="evenodd"
					/>
				</svg>
				Clear
			</button>
		</div>
	</div>
{/if}

<!-- ── Centered hero ───────────────────────────────────────────────────────── -->
<div class="mx-auto max-w-2xl text-center">
	<h1 class="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
		Screen humanitarian data<br class="hidden sm:block" /> for Risk of Excess Mortality
	</h1>
	<p class="text-base-content/80 mx-auto mt-3 max-w-xl leading-relaxed">
		From a CSV of indicator values, this tool validates, flags, and classifies each unit of analysis
		against reference thresholds — automatically.
	</p>
</div>

<!-- ── Upload card ────────────────────────────────────────────────────────── -->
<div class="mx-auto mt-8 max-w-lg">
	<div class="card bg-base-100 border-base-300 border shadow-sm">
		<div class="card-body gap-0">
			<div class="flex items-start justify-between gap-3">
				<div>
					<h2 class="text-base font-semibold">Upload your dataset</h2>
					<p class="text-base-content/70 mt-0.5 text-sm">
						CSV with a <code class="text-base-content/95">uoa</code> column and indicator columns.
					</p>
				</div>
				<button
					class="btn btn-ghost btn-xs text-base-content/55 hover:text-base-content shrink-0 cursor-pointer gap-1"
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

			<div class="mt-4">
				<CsvUploader onparsed={onParsed} onerror={onParseError} oncleared={clearAll} />
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
				<div class="mt-4 flex items-center gap-2.5">
					<span class="loading loading-spinner loading-xs text-primary"></span>
					<span class="text-base-content/75 text-sm">Validating…</span>
				</div>
			{:else if validationResult && !validationResult.ok}
				<div
					class="border-error/20 bg-error/6 mt-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
				>
					<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
						<span class="badge badge-error badge-sm">Validation failed</span>
						<span class="text-base-content/75 text-xs">
							{#if validationResult.headerErrors?.length}
								{validationResult.headerErrors.length} header error{validationResult.headerErrors
									.length !== 1
									? 's'
									: ''}
								{#if validationResult.cellErrors?.length || validationResult.warnings?.length}·{/if}
							{/if}
							{#if validationResult.cellErrors?.length}
								{validationResult.cellErrors.length} cell error{validationResult.cellErrors
									.length !== 1
									? 's'
									: ''}
								{#if validationResult.warnings?.length}·{/if}
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
					<span class="text-base-content/70 text-xs">
						{validationResult.numericObjects?.length ?? 0} rows · {lastHeader.length} columns
					</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Post-processing CTA -->
	{#if validationPassed || hasPreviousResults}
		<div
			class="border-primary/20 bg-primary/5 mt-3 flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
		>
			<p class="text-base-content/90 text-xs">Data processed — ready to explore.</p>
			<div>
				<NavButton
					href={resolve('/results')}
					label="View Results"
					direction="forward"
					variant="primary"
					size="sm"
				/>
				<NavButton
					href={resolve('/download')}
					label="Download"
					direction="forward"
					variant="outline"
					size="sm"
				/>
			</div>
		</div>
	{/if}
</div>

<!-- ── How it works ───────────────────────────────────────────────────────── -->
<div class="mt-16">
	<p class="mb-6 text-center text-lg font-semibold tracking-widest uppercase">How it works</p>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		{#each steps as step, i (i)}
			<div class="card bg-base-100 border-base-300 border shadow-sm">
				<div class="card-body">
					<!-- Icon -->
					<div
						class="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="size-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							{#if i === 0}
								<!-- Upload arrow -->
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
								<polyline points="17 8 12 3 7 8" />
								<line x1="12" y1="3" x2="12" y2="15" />
							{:else if i === 1}
								<!-- Flag -->
								<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
								<line x1="4" y1="22" x2="4" y2="15" />
							{:else}
								<!-- Bar chart -->
								<line x1="18" y1="20" x2="18" y2="10" />
								<line x1="12" y1="20" x2="12" y2="4" />
								<line x1="6" y1="20" x2="6" y2="14" />
							{/if}
						</svg>
					</div>

					<!-- Title + more info -->
					<div class="mt-3 flex items-baseline justify-between gap-2">
						<h3 class="text-lg font-semibold">{step.title}</h3>
						<button
							class="text-primary hover:text-primary shrink-0 cursor-pointer text-xs underline underline-offset-2 transition-colors duration-150"
							onclick={() => openStep(i)}
						>
							More info
						</button>
					</div>
					<p class="text-base-content/90 mt-1 text-sm">{step.desc}</p>
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- ── Caveat note ────────────────────────────────────────────────────────── -->
<div class="border-info/15 bg-info/8 mt-6 flex items-start gap-3 rounded-lg border px-4 py-3.5">
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
	<p class="text-base-content/90 text-sm leading-relaxed">
		The preliminary flag is a data-driven pre-screening result, not a conclusion. Each unit of
		analysis requires a full deep-dive before drawing final categories.
	</p>
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
		<div class="mb-5 flex flex-wrap gap-2">
			{#each steps as step, i (i)}
				<button
					class={[
						'cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150',
						activeStep === i
							? 'bg-primary text-primary-content'
							: 'bg-base-200 text-base-content/75 hover:text-base-content'
					].join(' ')}
					onclick={() => (activeStep = i)}
				>
					{i + 1}. {step.title}
				</button>
			{/each}
		</div>

		<h3 class="text-md font-bold">{steps[activeStep].title}</h3>
		<p class="text-base-content/55 mt-1 text-sm">{steps[activeStep].desc}</p>

		<div class="mt-5 space-y-3">
			{#each steps[activeStep].detail.sections as section (section.label)}
				{#if section.route}
					<a
						href={resolve(section.route)}
						class="border-base-300 hover:bg-base-200 bg-base-200/40 block rounded-lg border px-4 py-3.5"
					>
						<p class="text-base-content text-sm font-semibold">{section.label}</p>
						<p class="text-base-content/65 mt-1 text-sm">{section.body}</p>
					</a>
				{:else}
					<div class="border-base-300 bg-base-200/40 rounded-lg border px-4 py-3.5">
						<p class="text-base-content text-sm font-semibold">{section.label}</p>
						<p class="text-base-content/65 mt-1 text-sm">{section.body}</p>
					</div>
				{/if}
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
