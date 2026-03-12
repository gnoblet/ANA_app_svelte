<script>
	import { goto } from '$app/navigation';
	import { flagData, downloadJSON, downloadCSV } from '$lib/process_input/flagger.js';
	import { onMount } from 'svelte';

	// This page can be pre-rendered with an empty/placeholder state
	// When users navigate here with data in sessionStorage, the onMount hook loads and displays it
	// This provides both SEO benefits (page exists) and dynamic updates (data loads on client)
	export const prerender = true;

	let flaggingData = null;
	let flaggedResult = null;
	let isProcessing = false;
	let error = null;
	let hasCheckedStorage = false;

	onMount(() => {
		// Retrieve data from sessionStorage
		const stored = sessionStorage.getItem('flaggingData');
		if (stored) {
			try {
				flaggingData = JSON.parse(stored);
				processFlags();
			} catch (err) {
				error = `Failed to load flagging data: ${err.message}`;
			}
		}
		hasCheckedStorage = true;
	});

	async function processFlags() {
		if (!flaggingData) return;

		isProcessing = true;
		error = null;

		try {
			const { rows, indicatorMap } = flaggingData;

			// rows are numericObjects from the validator (array of plain JS objects)
			flaggedResult = flagData(rows, indicatorMap);
		} catch (err) {
			error = `Flagging failed: ${err.message}`;
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

	function handleGoBack() {
		goto('/validator');
	}
</script>

<div class="container mx-auto max-w-4xl p-4">
	<div class="card bg-base-100 shadow-lg">
		<div class="card-body">
			<h1 class="card-title text-2xl">Flagging Results</h1>

			{#if !hasCheckedStorage}
				<div class="flex flex-col items-center justify-center gap-4 py-8">
					<div class="text-lg">Loading...</div>
					<span class="loading loading-spinner loading-lg text-primary"></span>
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
						<h2 class="mb-2 text-2xl font-bold">No Data to Process</h2>
						<p class="mb-6 text-gray-600">
							Please go back to the main page, upload a CSV file, and validate it before flagging.
						</p>
						<button class="btn btn-primary" on:click={handleGoBack}> ← Back to Validator </button>
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
									{#each Object.keys(flaggedResult[0] || {}) as key}
										<th class="text-sm">{key}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each flaggedResult.slice(0, 5) as row}
									<tr>
										{#each Object.values(row) as value}
											<td class="text-sm">
												<code
													>{typeof value === 'boolean' ? (value ? '✓' : '✗') : value || '–'}</code
												>
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
						<button class="btn btn-primary" on:click={handleDownloadJSON}> Download JSON </button>
						<button class="btn btn-primary" on:click={handleDownloadCSV}> Download CSV </button>
						<button class="btn btn-outline" on:click={handleGoBack}> ← Back to Validator </button>
					</div>
				</div>
			{:else}
				<div class="py-8 text-center text-gray-500">No flagged data to display</div>
			{/if}
		</div>
	</div>
</div>
