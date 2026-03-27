<script lang="ts">
	import { onMount } from 'svelte';
	import { flagData, downloadJSON, downloadCSV, downloadXLSX } from '$lib/processing/flagger.js';
	import { downloadDeepDive } from '$lib/processing/deepdive.js';
	import { flagStore, setFlagResult, clearFlagResult } from '$lib/stores/flagStore.svelte';
	import Chevron from '$lib/components/ui/Chevron.svelte';
	import CheckCircleIcon from '$lib/components/ui/CheckCircleIcon.svelte';
	import ExclamationCircleIcon from '$lib/components/ui/ExclamationCircleIcon.svelte';
	import NoDataState from '$lib/components/ui/NoDataState.svelte';
	import { validatorStore, clearValidatorState } from '$lib/stores/validatorStore.svelte';
	import { indicatorsStore } from '$lib/stores/indicatorsStore.svelte';
	import { base } from '$app/paths';

	let flaggedResult: Record<string, unknown>[] | null = $state(null);
	let isProcessing = $state(false);
	let error = $state('');
	let selectedUoa = $state('');

	const uoaOptions = $derived.by((): string[] => {
		if (!flaggedResult) return [];
		return [...new Set(flaggedResult.map((r) => String(r['uoa'] ?? '')))];
	});

	$effect(() => {
		if (uoaOptions.length > 0 && !selectedUoa) {
			selectedUoa = uoaOptions[0] ?? '';
		}
	});

	onMount(() => {
		const stored = flagStore.flaggedResult;
		const validator = validatorStore;

		if (stored && stored.length > 0) {
			// Rehydrate from a previous flagging run
			flaggedResult = stored;
		} else if (
			validator.validationResult &&
			(validator.validationResult as any).ok &&
			(validator.validationResult as any).numericObjects?.length > 0
		) {
			// Validation passed and no flagging done yet — run automatically
			runFlagging(
				(validator.validationResult as any).numericObjects,
				validator.filename ?? undefined
			);
		}
	});

	async function runFlagging(rows: Record<string, number | null>[], filename?: string) {
		isProcessing = true;
		error = '';
		flaggedResult = null;

		try {
			const json = indicatorsStore.indicatorsJson;
			if (!json) {
				throw new Error(
					'Indicators metadata is not loaded yet. Please wait a moment and try again.'
				);
			}

			const result = flagData(rows, json);
			flaggedResult = result;
			const metadataCols =
				((validatorStore.validationResult as any)?.metadataCols as string[]) ?? [];
			setFlagResult(result, filename ?? null, metadataCols);
			clearValidatorState();
		} catch (err) {
			error = `Flagging failed: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			isProcessing = false;
		}
	}

	function handleDownloadJSON() {
		if (!flaggedResult) return;
		const timestamp = new Date().toISOString().split('T')[0];
		downloadJSON(flaggedResult, `flagged_data_${timestamp}.json`);
	}

	function handleDownloadCSV() {
		if (!flaggedResult) return;
		const timestamp = new Date().toISOString().split('T')[0];
		downloadCSV(flaggedResult, `flagged_data_${timestamp}.csv`);
	}

	function handleDownloadXLSX() {
		if (!flaggedResult) return;
		const timestamp = new Date().toISOString().split('T')[0];
		downloadXLSX(flaggedResult, `flagged_data_${timestamp}.xlsx`);
	}

	async function handleDownloadDeepDive() {
		if (!flaggedResult || !selectedUoa) return;
		const json = indicatorsStore.indicatorsJson;
		if (!json) return;
		const row = flaggedResult.find((r) => String(r['uoa']) === selectedUoa);
		if (!row) return;
		const timestamp = new Date().toISOString().split('T')[0];
		const hypothesesResp = await fetch(`${base}/data/hypotheses.json`);
		const hypothesesData = await hypothesesResp.json();
		await downloadDeepDive(row, json, hypothesesData, `deepdive_${selectedUoa}_${timestamp}.xlsx`);
	}

	function handleClear() {
		flaggedResult = null;
		error = '';
		clearFlagResult();
	}
</script>

<div class="card bg-base-100 shadow-lg">
	<div class="card-body">
		{#if isProcessing}
			<div class="flex flex-col items-center justify-center gap-4 py-8">
				<div class="text-lg">Processing data...</div>
				<span class="loading loading-spinner loading-lg text-primary"></span>
			</div>
		{:else if error}
			<div class="flex flex-col items-center justify-center gap-6 py-12">
				<div class="text-center">
					<ExclamationCircleIcon size="size-16" class="text-error mx-auto mb-4" />
					<h2 class="mb-2 text-2xl font-bold">Error Processing Data</h2>
					<p class="mb-6 text-base-content/60">{error}</p>
					<a href="{base}/" class="btn btn-primary"><Chevron variant="left" /> Back to Validator</a>
				</div>
			</div>
		{:else if flaggedResult}
			<div class="space-y-4">
				<div class="alert alert-success">
					<CheckCircleIcon size="size-6" class="shrink-0" />
					<span
						>Successfully flagged {flaggedResult.length} unit(s) of analysis against thresholds</span
					>
				</div>

				<div class="divider">Data Preview</div>

				<div class="overflow-x-auto">
					<table class="table-compact table w-full">
						<thead>
							<tr>
								{#each Object.keys(flaggedResult[0] || {}) as key (key)}
									<th class="text-sm">{key}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each flaggedResult.slice(0, 5) as row, rowIndex (rowIndex)}
								<tr>
									{#each Object.values(row) as value, colIndex (`${rowIndex}-${colIndex}`)}
										<td class="text-sm">
											<code
												>{typeof value === 'boolean' ? (value ? '✓' : '✗') : (value ?? '–')}</code
											>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if flaggedResult.length > 5}
					<div class="text-sm text-base-content/50">Showing 5 of {flaggedResult.length} rows...</div>
				{/if}

				<div class="divider">Deep Dive Export</div>

				<div class="flex flex-wrap items-center gap-3">
					<label class="flex items-center gap-2 text-sm font-medium" for="uoa-select">
						Unit of analysis
					</label>
					<select
						id="uoa-select"
						class="select select-bordered select-sm"
						bind:value={selectedUoa}
					>
						{#each uoaOptions as uoa (uoa)}
							<option value={uoa}>{uoa}</option>
						{/each}
					</select>
					<button
						class="btn btn-secondary btn-sm"
						disabled={!selectedUoa}
						onclick={handleDownloadDeepDive}
					>
						Download Deep Dive XLSX
					</button>
				</div>

				<div class="divider">Actions</div>

				<div class="flex flex-wrap gap-2">
					<button class="btn btn-primary" onclick={handleDownloadJSON}>Download JSON</button>
					<button class="btn btn-primary" onclick={handleDownloadCSV}>Download CSV</button>
					<button class="btn btn-primary" onclick={handleDownloadXLSX}>Download XLSX</button>
					<button class="btn btn-outline btn-error" onclick={handleClear}>Clear</button>
					<a href="{base}/" class="btn btn-outline"><Chevron variant="left" /> Back to Validator</a>
				</div>
			</div>
		{:else}
			<NoDataState />
		{/if}
	</div>
</div>
