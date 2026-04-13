<script lang="ts">
	import Select from '$lib/components/ui/Select.svelte';
	import ButtonClear from '$lib/components/ui/ButtonClear.svelte';
	import PrelimFlagDonut from '$lib/components/viz/PrelimFlagDonut.svelte';
	import UoaRankingTable from '$lib/components/viz/UoaRankingTable.svelte';
	import ChoroplethMap from '$lib/components/viz/ChoroplethMap.svelte';
	import UoaDetailPanel from '$lib/components/viz/UoaDetailPanel.svelte';
	import { adminFeaturesStore } from '$lib/stores/adminFeaturesStore.svelte';

	type Row = Record<string, any>;
	type System = { id: string; label: string };
	type Option = { value: string; label: string };

	interface Props {
		flagged: Row[];
		filteredFlagged: Row[];
		systems: System[];
		systemCodes: Map<string, string[]>;
		metadataCols: string[];
		hasPcodes: boolean;
		pcodeLevel: 'ADM1' | 'ADM2';
		overviewUoaOptions: Option[];
		overviewSelectedUoas: string[] | null;
		selectedPrelimKeys: string[] | null;
		PRELIM_KEYS: string[];
		prelimOptions: Option[];
		groupByCol: string | null;
		groupByOptions: Option[];
		selectedGroupValues: string[];
		isFiltered: boolean;
		selectedMapUoa: string | null;
		selectedMapRow: Row | null;
		onoverviewuoaschange: (v: string | string[]) => void;
		onprelimkeyschange: (v: string | string[]) => void;
		ongroupbycol: (v: string | null) => void;
		ongroupvalueschange: (v: string | string[]) => void;
		onclearfilters: () => void;
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
		metadataCols,
		hasPcodes,
		pcodeLevel,
		overviewUoaOptions,
		overviewSelectedUoas,
		selectedPrelimKeys,
		PRELIM_KEYS,
		prelimOptions,
		groupByCol,
		groupByOptions,
		selectedGroupValues,
		isFiltered,
		selectedMapUoa,
		selectedMapRow,
		onoverviewuoaschange,
		onprelimkeyschange,
		ongroupbycol,
		ongroupvalueschange,
		onclearfilters,
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

	<!-- Filters -->
	<div class="bg-base-100 border-base-300 rounded-box mb-6 border px-5 py-4">
		<div class="flex flex-wrap items-end gap-4">
			<div class="max-w-72 min-w-48 flex-1">
				<Select
					label="Units of analysis"
					options={overviewUoaOptions}
					selected={overviewSelectedUoas ?? overviewUoaOptions.map((o) => o.value)}
					placeholder="All UOAs"
					onchange={onoverviewuoaschange}
				/>
			</div>
			<div class="max-w-72 min-w-48 flex-1">
				<Select
					label="Classification"
					options={prelimOptions}
					selected={selectedPrelimKeys ?? PRELIM_KEYS}
					placeholder="All classifications"
					onchange={onprelimkeyschange}
				/>
			</div>
			{#if metadataCols.length > 0}
				<div class="max-w-70 min-w-48 flex-1">
					<Select
						label="Filter by column"
						selected={groupByCol ?? ''}
						placeholder="(no extra filter)"
						options={metadataCols.map((c) => ({ value: c, label: c }))}
						onchange={(v) => ongroupbycol((Array.isArray(v) ? v[0] : v) || null)}
					/>
				</div>
				{#if groupByCol !== null && groupByOptions.length > 0}
					<div class="max-w-70 min-w-48 flex-1">
						<Select
							label="Filter values"
							options={groupByOptions}
							selected={selectedGroupValues}
							placeholder="Select values…"
							onchange={ongroupvalueschange}
						/>
					</div>
				{/if}
			{/if}
			{#if isFiltered}
				<div class="flex items-end gap-2 pb-1">
					<span class="text-base-content/50 text-sm">
						<strong>{filteredFlagged.length}</strong> / {flagged.length} UOAs
					</span>
					<ButtonClear label="Clear all" onclick={onclearfilters} />
				</div>
			{/if}
		</div>
	</div>

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
				onprelimclick={ondonutsliceclick}
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
					{#if selectedMapUoa}
						<div class="mt-4">
							<UoaDetailPanel
								uoa={selectedMapUoa}
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
