<script lang="ts">
	import CsvUploader from '$lib/components/data/CsvUploader.svelte';
	import ValidationDisplay from '$lib/components/data/ValidationDisplay.svelte';
	import { validateCsv } from '$lib/processing/validator.js';
	import { runPipeline } from '$lib/processing/pipeline';
	import { onMount } from 'svelte';
	import {
		validatorStore,
		saveValidatorState,
		clearValidatorState
	} from '$lib/stores/validatorStore.svelte';
	import { clearFlagResult } from '$lib/stores/flagStore.svelte';
	import { adminFeaturesStore, clearAdminFeatures } from '$lib/stores/adminFeaturesStore.svelte';
	import { indicatorsStore } from '$lib/stores/indicatorsStore.svelte';

	interface ParseError {
		message: string;
	}

	interface ValidationResult {
		ok: boolean;
		numericObjects?: Record<string, number | null>[];
		errors?: ParseError[];
	}

	interface Props {
		onValidationPassed?: () => void;
		onReset?: () => void;
	}

	let { onValidationPassed, onReset }: Props = $props();

	const indicatorMap = $derived(indicatorsStore.indicatorMap);

	let lastHeader: string[] = $state([]);
	let lastRows: Record<string, unknown>[] = $state([]);
	let validationResult: ValidationResult | null = $state(null);
	let parseErrors: ParseError[] | ParseError | null = $state(null);
	let filename: string | null = $state(null);
	let isValidating = $state(false);
	let pipelineError = $state<string | null>(null);

	onMount(() => {
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

		// New file uploaded — clear any previous flagging run.
		// Admin features are only cleared if in error state; cached boundaries are reused.
		clearFlagResult();
		if (adminFeaturesStore.fetchState === 'error') clearAdminFeatures();

		isValidating = true;
		const startTime = Date.now();

		setTimeout(() => {
			validationResult = validateCsv(lastHeader, lastRows, indicatorMap) as ValidationResult;
			const elapsed = Date.now() - startTime;
			const remaining = Math.max(0, 1000 - elapsed);

			const finish = async () => {
				isValidating = false;
				pipelineError = null;
				saveValidatorState(lastHeader, lastRows, validationResult as Record<string, unknown> | null, parseErrors, filename);
				if (validationResult?.ok && validationResult.numericObjects?.length) {
					try {
						await runPipeline({
							header: lastHeader,
							rows: lastRows as unknown as unknown[][],
							filename,
							indicatorMap,
							indicatorsJson: indicatorsStore.indicatorsJson
						});
					} catch (e) {
						pipelineError = e instanceof Error ? e.message : String(e);
					}
					onValidationPassed?.();
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
		clearValidatorState();
		clearFlagResult();
		clearAdminFeatures();
		onReset?.();
	}
</script>

<div class="w-full">
	<div class="hero bg-base-300 rounded-box min-h-64">
		<div class="hero-content text-center">
			<div class="max-w-xl">
				<h1 class="mt-8 text-5xl font-bold">ANA Flagging App</h1>
				<p class="mt-4 text-xl">
					Upload a CSV with a <code>uoa</code> column and indicator columns (e.g.
					<code>IND001</code>). Valid data will be flagged automatically.
				</p>
				<div class="mt-6">
					<CsvUploader
						title="Upload CSV"
						hintText="The CSV must have a header row with a <code>uoa</code> column and indicator columns."
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

	<div class="card mt-6 w-full">
		<div class="card-body">
			<h3 class="card-title">Validation result</h3>

			<ValidationDisplay
				result={validationResult}
				header={lastHeader}
				rows={lastRows}
				{indicatorMap}
				loading={isValidating}
			/>
		</div>
	</div>
</div>
