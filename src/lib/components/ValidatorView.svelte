<script lang="ts">
	import CsvUploader from '$lib/processing/CsvUploader.svelte';
	import ValidationDisplay from '$lib/processing/ValidationDisplay.svelte';
	import { validateCsv } from '$lib/processing/validator.js';
	import { onMount } from 'svelte';

	function saveState(
		header: string[],
		rows: Record<string, unknown>[],
		result: ValidationResult | null,
		errors: ParseError[] | ParseError | null
	) {
		const state = {
			lastHeader: header,
			lastRows: rows,
			validationResult: result,
			parseErrors: errors
		};
		sessionStorage.setItem('validatorState', JSON.stringify(state));
	}

	interface ParseError {
		message: string;
	}

	interface ValidationResult {
		ok: boolean;
		numericObjects?: Record<string, number | null>[];
		errors?: ParseError[];
	}

	interface Props {
		indicatorMap: Record<string, unknown>;
		onFlagClick: (data: {
			header: string[];
			rows: Record<string, number | null>[];
			indicatorMap: Record<string, unknown>;
		}) => void;
		onDataReset: () => void;
	}

	let { indicatorMap, onFlagClick, onDataReset }: Props = $props();

	let lastHeader: string[] = $state([]);
	let lastRows: Record<string, unknown>[] = $state([]);
	let validationResult: ValidationResult | null = $state(null);
	let parseErrors: ParseError[] | ParseError | null = $state(null);
	let isValidating = $state(false);

	onMount(() => {
		// Restore validator state from sessionStorage
		const savedState = sessionStorage.getItem('validatorState');
		if (savedState) {
			try {
				const state = JSON.parse(savedState);
				lastHeader = state.lastHeader || [];
				lastRows = state.lastRows || [];
				validationResult = state.validationResult || null;
				parseErrors = state.parseErrors || null;
			} catch (err) {
				console.error('Failed to restore validator state:', err);
			}
		}
	});

	function handleLetsFlagClick() {
		if (!validationResult?.numericObjects) return;

		const flaggingData = {
			header: lastHeader,
			rows: validationResult.numericObjects,
			indicatorMap
		};
		onFlagClick(flaggingData);
		// Anchor link will handle navigation
	}

	function onParsed(e: CustomEvent) {
		parseErrors = e.detail && e.detail.errors && e.detail.errors.length ? e.detail.errors : null;
		lastHeader = e.detail.header || [];
		lastRows = e.detail.rows || [];

		// Reset flagging data when new file is uploaded
		onDataReset();

		isValidating = true;
		const startTime = Date.now();
		setTimeout(() => {
			validationResult = validateCsv(lastHeader, lastRows, indicatorMap);
			const elapsedTime = Date.now() - startTime;
			const remainingTime = Math.max(0, 1000 - elapsedTime);
			if (remainingTime > 0) {
				setTimeout(() => {
					isValidating = false;
					saveState(lastHeader, lastRows, validationResult, parseErrors);
				}, remainingTime);
			} else {
				isValidating = false;
				saveState(lastHeader, lastRows, validationResult, parseErrors);
			}
		}, 0);
	}

	function onParseError(e: CustomEvent) {
		parseErrors = e.detail || { message: 'Unknown parse error' };
		validationResult = null;
		lastHeader = [];
		lastRows = [];
	}

	function clearAll() {
		validationResult = null;
		lastHeader = [];
		lastRows = [];
		parseErrors = null;
		sessionStorage.removeItem('validatorState');

		// Reset flagging data when cleared
		onDataReset();
	}
</script>

<div class="w-full" id="validator">
	<div class="hero bg-base-200 min-h-2/3:">
		<div class="hero-content text-center">
			<div class="max-w-l">
				<h1 class="text-5xl font-bold">
					This is a simple app to add your input data and visualize
				</h1>
				<div>
					<CsvUploader
						title="Upload CSV"
						hintText="Choose a CSV file. The CSV should have a header row including a <code>uoa</code> column and indicator columns (e.g. <code>IND001</code>)."
						on:parsed={onParsed}
						on:error={onParseError}
						on:cleared={clearAll}
					/>

					{#if parseErrors}
						<div style="margin-top:0.75rem" class="err">
							<strong>Parsing errors:</strong>
							<ul>
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
	<div class="card card-border bg-base-100 w-4xl shadow-sm">
		<div class="card-body">
			<h3 class="card-title">Validation result</h3>
			{#if !isValidating && validationResult && validationResult.ok && validationResult.numericObjects}
				<div class="mb-4">
					<a href="#flagging" class="btn btn-primary" onclick={handleLetsFlagClick}>Let's flag →</a>
				</div>
			{/if}
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
