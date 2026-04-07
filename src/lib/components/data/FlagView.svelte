<script lang="ts">
	import { downloadJSON, downloadCSV, downloadXLSX } from '$lib/processing/download';
	import { downloadDeepDiveZip } from '$lib/processing/deepdive';
	import { flagStore, clearFlagResult } from '$lib/stores/flagStore.svelte';
	import NoDataState from '$lib/components/ui/NoDataState.svelte';
	import { indicatorsStore } from '$lib/stores/indicatorsStore.svelte';
	import { tidy, select, everything } from '@tidyjs/tidy';
	import { base } from '$app/paths';
	import FlagDownloadsCard from '$lib/components/data/FlagDownloadsCard.svelte';
	import FlagDataPreview from '$lib/components/data/FlagDataPreview.svelte';

	// Pure display component: reads flagged results directly from the store.
	// Flagging is now performed eagerly by pipeline.ts as soon as validation passes.
	const flaggedResult = $derived(flagStore.flaggedResult ?? null);

	let selectedUoas = $state<string[]>([]);

	const uoaOptions = $derived.by((): string[] => {
		if (!flaggedResult) return [];
		return [...new Set(flaggedResult.map((r) => String(r['uoa'] ?? '')))];
	});

	$effect(() => {
		if (uoaOptions.length > 0 && selectedUoas.length === 0) {
			selectedUoas = [...uoaOptions];
		}
	});

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

	async function handleDownloadDeepDiveZip() {
		if (!flaggedResult || selectedUoas.length === 0) return;
		const json = indicatorsStore.indicatorsJson;
		if (!json) return;
		const rows = flaggedResult.filter((r) => selectedUoas.includes(String(r['uoa'] ?? '')));
		if (rows.length === 0) return;
		const timestamp = new Date().toISOString().split('T')[0];
		const hypothesesResp = await fetch(`${base}/data/hypotheses.json`);
		const hypothesesData = await hypothesesResp.json();
		await downloadDeepDiveZip(rows, json, hypothesesData, `deepdives_${timestamp}.zip`);
	}

	function handleClear() {
		selectedUoas = [];
		clearFlagResult();
	}

	const orderedRows = $derived(
		tidy(flaggedResult ?? [], select(['uoa', 'prelim_flag', everything()])) as Record<
			string,
			unknown
		>[]
	);
</script>

{#if flaggedResult}
	<div class="space-y-4">
		<FlagDownloadsCard
			count={flaggedResult.length}
			{uoaOptions}
			{selectedUoas}
			onUoasChange={(v) => (selectedUoas = v)}
			onDownloadJSON={handleDownloadJSON}
			onDownloadCSV={handleDownloadCSV}
			onDownloadXLSX={handleDownloadXLSX}
			onDownloadDeepDive={handleDownloadDeepDiveZip}
			onClear={handleClear}
		/>
		<FlagDataPreview rows={orderedRows} />
	</div>
{:else}
	<NoDataState />
{/if}
