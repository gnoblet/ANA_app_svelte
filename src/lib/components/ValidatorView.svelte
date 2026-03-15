<script lang="ts">
	import CsvUploader from '$lib/processing/CsvUploader.svelte';
	import ValidationDisplay from '$lib/processing/ValidationDisplay.svelte';
	import { validateCsv } from '$lib/processing/validator.js';
	import { onMount } from 'svelte';
	import {
		validatorStore,
		saveValidatorState,
		clearValidatorState
	} from '$lib/stores/validatorStore.js';
	import { clearFlagResult } from '$lib/stores/flagStore.js';
	import { indicatorsStore } from '$lib/stores/indicatorsStore.js';

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

	const indicatorMap = $derived($indicatorsStore.indicatorMap);

	let lastHeader: string[] = $state([]);
	let lastRows: Record<string, unknown>[] = $state([]);
	let validationResult: ValidationResult | null = $state(null);
	let parseErrors: ParseError[] | ParseError | null = $state(null);
	let filename: string | null = $state(null);
	let isValidating = $state(false);

	onMount(() => {
		const s = $validatorStore;
		lastHeader = s.lastHeader ?? [];
		lastRows = s.lastRows ?? [];
		validationResult = (s.validationResult as ValidationResult | null) ?? null;
		parseErrors = (s.parseErrors as ParseError[] | ParseError | null) ?? null;
		filename = s.filename ?? null;
	});

	function onParsed(e: CustomEvent) {
		parseErrors = e.detail?.errors?.length ? e.detail.errors : null;
		lastHeader = e.detail.header ?? [];
		lastRows = e.detail.rows ?? [];
		filename = e.detail.filename ?? null;

		// New file uploaded — clear any previous flagging run
		clearFlagResult();

		isValidating = true;
		const startTime = Date.now();

		setTimeout(() => {
			validationResult = validateCsv(lastHeader, lastRows, indicatorMap) as ValidationResult;
			const elapsed = Date.now() - startTime;
			const remaining = Math.max(0, 1000 - elapsed);

			const finish = () => {
				isValidating = false;
				saveValidatorState(lastHeader, lastRows, validationResult, parseErrors, filename);
				if (validationResult?.ok && validationResult.numericObjects?.length) {
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
		onReset?.();
	}
</script>

<div class="w-full">
	<div class="hero bg-base-200 min-h-64">
		<div class="hero-content text-center">
			<div class="max-w-lg">
				<h1 class="text-5xl font-bold">ANA Flagging App</h1>
				<p class="mt-4 text-gray-500">
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
				</div>
			</div>
		</div>
	</div>

	<div class="card card-border bg-base-100 mt-6 w-full shadow-sm">
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
