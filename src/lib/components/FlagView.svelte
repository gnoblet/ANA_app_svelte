<script lang="ts">
	import { flagData, downloadJSON, downloadCSV } from '$lib/process_input/flagger.js';
	import { onMount } from 'svelte';

	interface FlaggingData {
		header: string[];
		rows: Record<string, number | null>[];
		indicatorMap: Record<string, unknown>;
	}

	interface Props {
		flaggingData: FlaggingData | null;
		onBackClick: () => void;
	}

	let { flaggingData, onBackClick }: Props = $props();

	let flaggedResult: Record<string, unknown>[] | null = $state(null);
	let isProcessing = $state(true);
	let error = $state('');

	$effect(() => {
		if (flaggingData) {
			processFlags();
		}
	});

	async function processFlags() {
		if (!flaggingData) return;

		isProcessing = true;
		error = '';

		try {
			const { rows, indicatorMap } = flaggingData;
			flaggedResult = flagData(rows, indicatorMap);
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
</script>

<div class="card bg-base-100 shadow-lg" id="flagging">
	<div class="card-body">
		<h1 class="card-title text-2xl">Flagging Results</h1>

		{#if !flaggingData}
			<div class="flex flex-col items-center justify-center gap-6 py-12">
				<div class="text-center">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-warning mx-auto mb-4 h-16 w-16"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<h2 class="mb-2 text-2xl font-bold">No Data to Process</h2>
					<p class="mb-6 text-gray-600">
						Please go back to the validator, upload a CSV file, and validate it before flagging.
					</p>
					<a href="#validator" class="btn btn-primary"> ← Back to Validator </a>
				</div>
			</div>
		{:else if error && !flaggedResult}
			<div class="flex flex-col items-center justify-center gap-6 py-12">
				<div class="text-center">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-warning mx-auto mb-4 h-16 w-16"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<h2 class="mb-2 text-2xl font-bold">Error Processing Data</h2>
					<p class="mb-6 text-gray-600">{error}</p>
					<button class="btn btn-primary" onclick={onBackClick}> ← Back to Validator </button>
				</div>
			</div>
		{:else if isProcessing}
			<div class="flex flex-col items-center justify-center gap-4 py-8">
				<div class="text-lg">Processing data...</div>
				<span class="loading loading-spinner loading-lg text-primary"></span>
			</div>
		{:else if flaggedResult}
			<div class="space-y-4">
				<div class="alert alert-success">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>Successfully flagged {flaggedResult.length} row(s) against thresholds</span>
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
									{#each Object.values(row) as value, colIndex (rowIndex + '-' + colIndex)}
										<td class="text-sm">
											<code>{typeof value === 'boolean' ? (value ? '✓' : '✗') : value || '–'}</code>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if flaggedResult.length > 5}
					<div class="text-sm text-gray-500">
						Showing 5 of {flaggedResult.length} rows...
					</div>
				{/if}

				<div class="divider">Actions</div>

				<div class="flex gap-2">
					<button class="btn btn-primary" onclick={handleDownloadJSON}> Download JSON </button>
					<button class="btn btn-primary" onclick={handleDownloadCSV}> Download CSV </button>
					<a href="#validator" class="btn btn-outline"> ← Back to Validator </a>
				</div>
			</div>
		{:else}
			<div class="py-8 text-center text-gray-500">No flagged data to display</div>
		{/if}
	</div>
</div>
