<script lang="ts">
	import { base, resolve } from '$app/paths';
	import { flagStore } from '$lib/stores/flagStore.svelte';
	import { indicatorsStore } from '$lib/stores/indicatorsStore.svelte';
	import { downloadJSON, downloadCSV, downloadXLSX } from '$lib/engine/download';
	import { downloadDeepDiveZip } from '$lib/engine/download';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import NavButton from '$lib/components/ui/NavButton.svelte';
	import DataGuard from '$lib/components/ui/DataGuard.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	const flagged = $derived(flagStore.flaggedResult ?? []);
	const hasData = $derived(flagged.length > 0);

	const allUoas = $derived([...new Set(flagged.map((r) => String(r['uoa'] ?? '')))]);

	// Writable $derived — resets to all UOAs when flagged data changes, but allows user selection
	let selectedUoas = $derived(allUoas) as string[];

	const timestamp = $derived(new Date().toISOString().split('T')[0]);

	function handleJSON() {
		if (!flagStore.flaggedResult) return;
		downloadJSON(flagStore.flaggedResult, `flagged_data_${timestamp}.json`);
	}

	function handleCSV() {
		if (!flagStore.flaggedResult) return;
		downloadCSV(flagStore.flaggedResult, `flagged_data_${timestamp}.csv`);
	}

	function handleXLSX() {
		if (!flagStore.flaggedResult) return;
		downloadXLSX(flagStore.flaggedResult, `flagged_data_${timestamp}.xlsx`);
	}

	async function handleDeepDive() {
		if (!flagStore.flaggedResult || selectedUoas.length === 0) return;
		const json = indicatorsStore.indicatorsJson;
		if (!json) return;
		const rows = flagStore.flaggedResult.filter((r) =>
			selectedUoas.includes(String(r['uoa'] ?? ''))
		);
		if (rows.length === 0) return;
		const hypothesesResp = await fetch(`${base}/data/hypotheses.json`);
		const hypothesesData = await hypothesesResp.json();
		await downloadDeepDiveZip(rows, json, hypothesesData, `deepdives_${timestamp}.zip`);
	}
</script>

<PageHeader
	title="Downloads"
	subtitle="Export your flagged dataset or generate pre-filled deep-dive workbooks per unit of analysis."
>
	{#snippet action()}
		<NavButton href={resolve('/results')} label="Go to Results" direction="forward" />
	{/snippet}
</PageHeader>

<DataGuard {hasData} variant="none">
	<div class="space-y-6">
		<!-- Summary alert -->
		<div class="alert alert-success">
			<svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
			</svg>
			<span>
				<strong>{flagged.length}</strong> unit{flagged.length !== 1 ? 's' : ''} of analysis processed against thresholds
				{#if flagStore.filename} — <span class="font-medium">{flagStore.filename}</span>{/if}
				{#if flagStore.uploadedAt} · {new Date(flagStore.uploadedAt).toLocaleString()}{/if}
			</span>
		</div>

		<!-- Flat exports -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div class="card bg-base-100 border-base-300/40 border shadow-sm">
				<div class="card-body gap-3">
					<h2 class="card-title text-base">JSON</h2>
					<p class="text-base-content/70 flex-1 text-sm">
						Full flagged dataset with all indicator values, status flags, and rolled-up
						classifications. Ideal for programmatic use.
					</p>
					<button class="btn btn-primary btn-sm w-full" onclick={handleJSON}>Download JSON</button>
				</div>
			</div>

			<div class="card bg-base-100 border-base-300/40 border shadow-sm">
				<div class="card-body gap-3">
					<h2 class="card-title text-base">CSV</h2>
					<p class="text-base-content/70 flex-1 text-sm">
						Flat tabular export compatible with Excel, R, or Python. All columns included, one row
						per UOA.
					</p>
					<button class="btn btn-primary btn-sm w-full" onclick={handleCSV}>Download CSV</button>
				</div>
			</div>

			<div class="card bg-base-100 border-base-300/40 border shadow-sm">
				<div class="card-body gap-3">
					<h2 class="card-title text-base">Excel (XLSX)</h2>
					<p class="text-base-content/70 flex-1 text-sm">
						Same as CSV but formatted as a native Excel workbook — useful for sharing with
						non-technical audiences.
					</p>
					<button class="btn btn-primary btn-sm w-full" onclick={handleXLSX}>Download XLSX</button>
				</div>
			</div>
		</div>

		<!-- Deep dives -->
		<div class="card bg-base-100 border-base-300/40 border shadow-sm">
			<div class="card-body gap-4">
				<div>
					<h2 class="card-title">Deep-dive packages</h2>
					<p class="text-base-content/70 mt-1 text-sm">
						Generate one workbook per selected UOA, pre-filled with its indicator values,
						classifications, and analytical context. Delivered as a single ZIP archive.
					</p>
				</div>

				<div class="flex flex-wrap items-end gap-4">
					<div class="max-w-72 min-w-60 flex-1">
						<Select
							label="Units of analysis"
							options={allUoas.map((v) => ({ value: v, label: v }))}
							selected={selectedUoas}
							onchange={(v) => (selectedUoas = Array.isArray(v) ? v : [v])}
						/>
					</div>
					<button
						class="btn btn-secondary"
						disabled={selectedUoas.length === 0}
						onclick={handleDeepDive}
					>
						Download ZIP ({selectedUoas.length} UOA{selectedUoas.length !== 1 ? 's' : ''})
					</button>
				</div>
			</div>
		</div>
	</div>
</DataGuard>
