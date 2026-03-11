<script>
	import { goto } from '$app/navigation';
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
		// Store data in session/state and navigate to flagging route
		const flaggingData = {
			header: lastHeader,
			rows: lastRows,
			indicatorMap
		};
		// Store in sessionStorage for the flagging page to access
		sessionStorage.setItem('flaggingData', JSON.stringify(flaggingData));
		goto('/flag');
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

<div>
	<div class="card card-border bg-base-100 w-4xl shadow-sm">
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

	<div class="card card-border bg-base-100 w-4xl shadow-sm">
		<div class="card-body">
			<h3 class="card-title">Validation result</h3>
			<ValidationDisplay
				result={validationResult}
				header={lastHeader}
				rows={lastRows}
				{indicatorMap}
				loading={isValidating}
			/>
			{#if validationResult && validationResult.ok}
				<div class="mt-6 flex gap-2">
					<button class="btn btn-primary" on:click={handleLetsFlagClick}> Let's flag → </button>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.page {
		padding: 1rem;
		max-width: 960px;
		margin: 0 auto;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			Roboto,
			'Helvetica Neue',
			Arial;
	}
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.status {
		color: #374151;
		font-size: 0.95rem;
	}
	.err {
		color: #b91c1c;
	}
	.box {
		background: #fff;
		border: 1px solid #e5e7eb;
		padding: 1rem;
		border-radius: 8px;
		margin-top: 1rem;
	}
</style>
