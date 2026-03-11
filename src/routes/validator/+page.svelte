<script>
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

	// Option: treat empty indicator cells as errors
	let requireNonEmpty = false;

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
		validationResult = validateCsv(lastHeader, lastRows, indicatorMap, { requireNonEmpty });
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

<div class="page">
	<div class="header">
		<h1>CSV Validator</h1>
		<div class="controls">
			{#if loadingIndicators}
				<div class="status">Loading indicators…</div>
			{:else if indicatorsError}
				<div class="err">Failed to load indicators: {indicatorsError}</div>
			{:else}
				<div class="status">Indicators loaded: {Object.keys(indicatorMap).length}</div>
			{/if}
		</div>
	</div>

	<div class="box">
		<h2 style="margin:0 0 0.5rem 0">Upload CSV</h2>
		<p class="status" style="margin:0 0 0.5rem 0">
			Drop or choose a CSV file. The CSV should have a header row including a <code>uoa</code>
			column and indicator columns (e.g. <code>IND001</code>).
		</p>

		<CsvUploader on:parsed={onParsed} on:error={onParseError} />

		<div style="margin-top:0.75rem; display:flex; gap:0.5rem; align-items:center">
			<label style="display:flex; align-items:center; gap:0.4rem">
				<input type="checkbox" bind:checked={requireNonEmpty} />
				<span class="status"
					>Require all indicator cells to be non-empty (treat missing as error)</span
				>
			</label>

			<button
				on:click={clearAll}
				style="margin-left:auto; padding:0.4rem 0.6rem; border-radius:6px; border:1px solid #d1d5db; background:#fff"
				>Clear</button
			>
		</div>

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

	<div class="box" style="margin-top:1rem">
		<h2 style="margin:0 0 0.5rem 0">Validation Result</h2>
		{#if validationResult}
			<ValidationDisplay
				result={validationResult}
				header={lastHeader}
				rows={lastRows}
				{indicatorMap}
			/>
		{:else}
			<div class="status">No validation run yet.</div>
		{/if}
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
