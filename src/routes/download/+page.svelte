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

<svelte:head>
	<title>Downloads | ANA App</title>
</svelte:head>

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
		<!-- Stat bar -->
		<div
			class="bg-base-200/60 border-base-300 rounded-box flex items-center gap-3 border px-5 py-3"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="text-success size-5 shrink-0"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
			</svg>
			<p class="text-sm">
				<strong>{flagged.length}</strong> unit{flagged.length !== 1 ? 's' : ''} of analysis processed
				and ready to export.
			</p>
		</div>

		<!-- Flat exports -->
		<div>
			<p class="text-base-content/75 mb-3 font-semibold uppercase">Export dataset</p>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<button
					class="group border-base-300 hover:border-primary hover:bg-primary/5 rounded-box flex cursor-pointer items-start gap-4 border px-5 py-4 text-left transition-colors duration-150"
					onclick={handleJSON}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-base-content/35 group-hover:text-primary mt-0.5 size-7 shrink-0 transition-colors duration-150"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline
							points="14 2 14 8 20 8"
						/>
						<line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
					</svg>
					<div>
						<p class="text-sm font-semibold">JSON</p>
						<p class="text-base-content/75 mt-0.5 text-sm">
							Nested hierarchical format. Ideal for programmatic use.
						</p>
					</div>
				</button>

				<button
					class="group border-base-300 hover:border-primary hover:bg-primary/5 rounded-box flex cursor-pointer items-start gap-4 border px-5 py-4 text-left transition-colors duration-150"
					onclick={handleCSV}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-base-content/35 group-hover:text-primary mt-0.5 size-7 shrink-0 transition-colors duration-150"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<rect x="3" y="3" width="18" height="18" rx="2" />
						<line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
						<line x1="9" y1="3" x2="9" y2="21" />
					</svg>
					<div>
						<p class="text-sm font-semibold">CSV</p>
						<p class="text-base-content/75 mt-0.5 text-sm">
							Flat tabular. One row per UOA. Compatible with Excel, R, Python.
						</p>
					</div>
				</button>

				<button
					class="group border-base-300 hover:border-primary hover:bg-primary/5 rounded-box flex cursor-pointer items-start gap-4 border px-5 py-4 text-left transition-colors duration-150"
					onclick={handleXLSX}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-base-content/35 group-hover:text-primary mt-0.5 size-7 shrink-0 transition-colors duration-150"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline
							points="14 2 14 8 20 8"
						/>
						<path d="M8 13l2 2 4-4" />
					</svg>
					<div>
						<p class="text-sm font-semibold">Excel (XLSX)</p>
						<p class="text-base-content/75 mt-0.5 text-sm">
							Native workbook. Useful for sharing with non-technical audiences.
						</p>
					</div>
				</button>
			</div>
		</div>

		<!-- Deep dives -->
		<p class="text-base-content/75 text mb-3 font-semibold uppercase">Deep-dive workbooks</p>
		<div class="card bg-base-100 border-base-300 border shadow-sm">
			<div class="card-body gap-4">
				<div>
					<h3 class="font-semibold">Pre-populated XLSX per unit of analysis</h3>
					<p class="text-base-content/80 mt-1 text-sm">
						One workbook per selected UOA, pre-filled with indicator values and preliminary flags.
						Delivered as a single ZIP archive.
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
						class="btn btn-secondary btn-sm"
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
