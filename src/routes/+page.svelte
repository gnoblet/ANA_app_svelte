<script lang="ts">
	import { onMount } from 'svelte';
	import CsvUploader from '$lib/process_input/CsvUploader.svelte';
	import ValidationDisplay from '$lib/process_input/ValidationDisplay.svelte';
	import { loadIndicators, flattenIndicators } from '$lib/process_input/indicators.js';
	import { validateCsv } from '$lib/process_input/validator.js';

	let indicatorMap = {};
	let loadingIndicators = true;
	let indicatorsError = null;

	let lastHeader = [];
	let lastRows = [];
	let validationResult = null;
	let parseErrors = null;
	let isValidating = false;

	function handleLetsFlagClick() {
		// Require that the validator produced numericObjects (plain JS objects with numeric indicator values).
		// If numericObjects are missing, do not proceed to flagging — the validator must convert values to numeric first.
		if (!validationResult || !validationResult.numericObjects) {
			// Surface a helpful parse/validation message to the user area (reuse parseErrors display).
			parseErrors = {
				message:
					'Numeric conversion required for flagging. Please fix validation errors and ensure all indicator cells are numeric.'
			};
			return false;
		}

		// Use numericObjects (validator guarantees numbers/nulls)
		const rowsToUse = validationResult.numericObjects;

		// Store data in session/state and navigate to flagging route
		const flaggingData = {
			header: lastHeader,
			rows: rowsToUse,
			indicatorMap
		};
		// Store in sessionStorage for the flagging page to access
		sessionStorage.setItem('flaggingData', JSON.stringify(flaggingData));
		return true;
	}

	// Option: treat empty indicator cells as errors

	onMount(async () => {
		loadingIndicators = true;
		indicatorsError = null;
		try {
			const json = await loadIndicators();
			indicatorMap = flattenIndicators(json);
		} catch (err) {
			indicatorsError = err && err.message ? err.message : String(err);
			indicatorMap = {};
		} finally {
			loadingIndicators = false;
		}
	});

	// Handler for parsed event from CsvUploader
	function onParsed(e) {
		parseErrors = e.detail && e.detail.errors && e.detail.errors.length ? e.detail.errors : null;
		lastHeader = e.detail.header || [];
		lastRows = e.detail.rows || [];
		// Run validation
		isValidating = true;
		// Use setTimeout to ensure loading spinner shows for at least 1 second
		const startTime = Date.now();
		setTimeout(() => {
			validationResult = validateCsv(lastHeader, lastRows, indicatorMap);
			const elapsedTime = Date.now() - startTime;
			const remainingTime = Math.max(0, 1000 - elapsedTime);
			if (remainingTime > 0) {
				setTimeout(() => {
					isValidating = false;
				}, remainingTime);
			} else {
				isValidating = false;
			}
		}, 0);
	}

	function onParseError(e) {
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
	}
</script>

<div class="w-full">
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
									{#each parseErrors as pe}
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
					<a href="/flag" class="btn btn-primary" on:click={() => handleLetsFlagClick()}
						>Let's flag →</a
					>
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
