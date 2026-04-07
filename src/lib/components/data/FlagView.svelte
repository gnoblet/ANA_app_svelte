<script lang="ts">
	import { downloadJSON, downloadCSV, downloadXLSX } from '$lib/processing/download';
	import { downloadDeepDiveZip } from '$lib/processing/deepdive';
	import Select from '$lib/components/ui/Select.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import { flagStore, clearFlagResult } from '$lib/stores/flagStore.svelte';
	import NavButton from '$lib/components/ui/NavButton.svelte';
	import CheckCircleIcon from '$lib/components/ui/CheckCircleIcon.svelte';
	import NoDataState from '$lib/components/ui/NoDataState.svelte';
	import { indicatorsStore } from '$lib/stores/indicatorsStore.svelte';
	import { tidy, select, everything } from '@tidyjs/tidy';
	import { base } from '$app/paths';
	import PrelimBadge from '$lib/components/ui/PrelimBadge.svelte';

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
		tidy(flaggedResult ?? [], select(['uoa', 'prelim_flag', everything()]))
	);
</script>

{#if flaggedResult}
	<div class="card bg-base-100 border-base-300/40 border shadow-sm">
		<div class="card-body">
			<div class="space-y-4">
				<div class="alert alert-success">
					<CheckCircleIcon size="size-6" class="shrink-0" />
					<span
						>Successfully flagged {flaggedResult.length} unit(s) of analysis against thresholds</span
					>
				</div>

				<div class="divider">Data Preview</div>

				<DataTable rows={orderedRows} pageSize={10} searchable={true}>
					{#snippet renderCell({ col, value }: { col: string; value: string })}
						{#if col === 'prelim_flag'}
							<PrelimBadge {value} />
						{:else}
							{value}
						{/if}
					{/snippet}
				</DataTable>

				<div class="flex flex-wrap items-end gap-3">
					<div class="w-72">
						<Select
							options={uoaOptions.map((v) => ({ value: v, label: v }))}
							selected={selectedUoas}
							onchange={(v) => (selectedUoas = v as string[])}
							label="Units of analysis"
						/>
					</div>
					<button
						class="btn btn-secondary btn-sm"
						disabled={selectedUoas.length === 0}
						onclick={handleDownloadDeepDiveZip}
					>
						Download Deep Dive ZIP
					</button>
				</div>

				<div class="flex flex-wrap gap-2">
					<button class="btn btn-primary btn-sm" onclick={handleDownloadJSON}>Download JSON</button>
					<button class="btn btn-primary btn-sm" onclick={handleDownloadCSV}>Download CSV</button>
					<button class="btn btn-primary btn-sm" onclick={handleDownloadXLSX}>Download XLSX</button>
					<button class="btn btn-outline btn-error btn-sm" onclick={handleClear}>Clear</button>
					<NavButton href="{base}/" label="Back to Validator" direction="back" size="sm" />
				</div>
			</div>
		</div>
	</div>
{:else}
	<NoDataState />
{/if}
