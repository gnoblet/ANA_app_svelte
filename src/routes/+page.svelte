<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import CsvUploader from '$lib/components/data/CsvUploader.svelte';
	import ValidatorView from '$lib/components/data/ValidatorView.svelte';
	import FlagDataPreview from '$lib/components/data/FlagDataPreview.svelte';
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

{#if hasPreviousResults && !validationPassed}
	<div role="alert" class="alert alert-success mb-4 flex items-center justify-between">
		<div>
			<p class="font-semibold">Previous results available</p>
			<p class="text-sm">
				Your last dataset was processed successfully. The validator has been cleared, but results are
				still saved. To analyse new data, upload a new file below.
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

{#if hasPreviousResults && !validationPassed && flagStore.flaggedResult}
	<div class="mb-4">
		<FlagDataPreview rows={flagStore.flaggedResult as Record<string, unknown>[]} />
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

{#if validationPassed}
	<div class="mt-4 flex justify-center">
		<NavButton
			href={resolve('/results')}
			label="Go to Results"
			direction="forward"
			variant="primary"
		/>
	</div>
{/if}

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
