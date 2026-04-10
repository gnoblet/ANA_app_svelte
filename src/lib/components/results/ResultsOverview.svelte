<script lang="ts">
	import PrelimFlagDonut from '$lib/components/viz/PrelimFlagDonut.svelte';
	import UoaRankingTable from '$lib/components/viz/UoaRankingTable.svelte';
	import ChoroplethMap from '$lib/components/viz/ChoroplethMap.svelte';
	import UoaDetailPanel from '$lib/components/viz/UoaDetailPanel.svelte';
	import { adminFeaturesStore } from '$lib/stores/adminFeaturesStore.svelte';

	type Row = Record<string, any>;
	type System = { id: string; label: string };

	interface Props {
		flagged: Row[];
		filteredFlagged: Row[];
		systems: System[];
		systemCodes: Map<string, string[]>;
		hasPcodes: boolean;
		pcodeLevel: 'ADM1' | 'ADM2';
		selectedPrelimKeys: string[] | null;
		selectedMapUoa: string | null;
		selectedMapRow: Row | null;
		onselectinheatmap: (uoa: string, systemId: string) => void;
		onmapselect: (uoa: string) => void;
		onmapclear: () => void;
		ondonutsliceclick: (key: string | null) => void;
	}

	let {
		flagged,
		filteredFlagged,
		systems,
		systemCodes,
		hasPcodes,
		pcodeLevel,
		selectedPrelimKeys,
		selectedMapUoa,
		selectedMapRow,
		onselectinheatmap,
		onmapselect,
		onmapclear,
		ondonutsliceclick
	}: Props = $props();
</script>

<section id="overview" class="scroll-mt-28">
	<h2 class="text-base-content/40 mb-6 text-xs font-semibold tracking-widest uppercase">
		Overview
	</h2>

	<!-- Donut + ranking table -->
	<div class="mb-6 grid grid-cols-5 items-stretch gap-6">
		<div class="col-span-2">
			<PrelimFlagDonut
				rows={filteredFlagged}
				selectedKeys={selectedPrelimKeys}
				onsliceclick={ondonutsliceclick}
			/>
		</div>
		<div class="col-span-3">
			<UoaRankingTable
				rows={filteredFlagged}
				{systems}
				{systemCodes}
				onselect={onselectinheatmap}
			/>
		</div>
	</div>

	<!-- Choropleth map -->
	{#if hasPcodes && adminFeaturesStore.fetchState !== 'error'}
		<div class="card bg-base-100 border-base-300 mt-6 border shadow-sm">
			<div class="card-body">
				<h3 class="card-title text-base">Preliminary classification map</h3>
				<p class="text-base-content/60 text-sm">Click an area to view its report.</p>
				{#if adminFeaturesStore.fetchState === 'loading'}
					<div class="text-base-content/50 flex items-center gap-2 py-6 text-sm">
						<span class="loading loading-spinner loading-sm"></span>
						Fetching admin boundaries…
					</div>
				{:else if adminFeaturesStore.adm1}
					<ChoroplethMap
						adm1={adminFeaturesStore.adm1}
						adm2={adminFeaturesStore.adm2}
						rows={filteredFlagged}
						level={pcodeLevel}
						onuoaclick={(uoa) => onmapselect(uoa)}
					/>
					{#if selectedMapRow}
						<div class="mt-4">
							<UoaDetailPanel
								uoa={selectedMapUoa!}
								row={selectedMapRow}
								{systems}
								{systemCodes}
								ondrilldown={onselectinheatmap}
								onclose={onmapclear}
							/>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</section>
