<script>
	import { goto } from '$app/navigation';
	import { flagData, downloadJSON } from '$lib/process_input/flagger.js';
	import { onMount } from 'svelte';

	let flaggingData = null;
	let flaggedResult = null;
	let isProcessing = false;
	let error = null;

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
		} else {
			error = 'No data to process. Please upload and validate a CSV first.';
		}
	});

	async function processFlags() {
		if (!flaggingData) return;

		isProcessing = true;
		error = null;

		try {
			const { header, rows, indicatorMap } = flaggingData;
			flaggedResult = flagData(header, rows, indicatorMap);
		} catch (err) {
			error = `Flagging failed: ${err.message}`;
		} finally {
			isProcessing = false;
		}
	}

	function handleDownload() {
		if (!flaggedResult) return;
		const timestamp = new Date().toISOString().split('T')[0];
		downloadJSON(flaggedResult, `flagged_data_${timestamp}.json`);
	}

	function handleGoBack() {
		goto('/validator');
	}
</script>

<div class="container mx-auto max-w-4xl p-4">
	<div class="card bg-base-100 shadow-lg">
		<div class="card-body">
			<h1 class="card-title text-2xl">Flagging Results</h1>

			{#if error}
				<div class="alert alert-error">
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
							d="M10 14l-2-2m0 0l-2-2m2 2l2-2m-2 2l-2 2"
						/>
					</svg>
					<span>{error}</span>
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
						<button class="btn btn-primary" on:click={handleDownload}> ⬇ Download JSON </button>
						<button class="btn btn-outline" on:click={handleGoBack}> ← Back to Validator </button>
					</div>
				</div>
			{:else}
				<div class="py-8 text-center text-gray-500">No flagged data to display</div>
			{/if}
		</div>
	</div>
</div>
