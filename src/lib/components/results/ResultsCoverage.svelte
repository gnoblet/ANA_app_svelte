<script lang="ts">
	import Select from '$lib/components/ui/Select.svelte';
	import RadioToggle from '$lib/components/ui/RadioToggle.svelte';
	import LegendBadge from '$lib/components/ui/LegendBadge.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import CirclePacking from '$lib/components/viz/CirclePacking.svelte';
	import { circlePackingStore } from '$lib/stores/circlePackingStore.svelte';

	type Row = Record<string, any>;

	interface Props {
		circlePackingDisplayData: unknown;
		coverageTableRows: Record<string, string>[];
		coverageSelectedRow: Row | null;
		showAvailableOnly: boolean;
		showCoverageTable: boolean;
	}

	let {
		circlePackingDisplayData,
		coverageTableRows,
		coverageSelectedRow,
		showAvailableOnly = $bindable(false),
		showCoverageTable = $bindable(false)
	}: Props = $props();
</script>

<section id="coverage" class="scroll-mt-28">
	<h2 class="text-base-content/40 mb-6 text-xs font-semibold tracking-widest uppercase">
		Coverage
	</h2>

	{#if circlePackingStore.loading}
		<div class="flex items-center justify-center gap-3 py-16">
			<span class="loading loading-spinner loading-md text-primary"></span>
			<p class="text-base-content/60 text-sm">Loading indicator framework…</p>
		</div>
	{:else if circlePackingStore.error}
		<p class="text-error text-sm">{circlePackingStore.error}</p>
	{:else}
		<div class="space-y-4">
			<!-- Controls -->
			<div class="flex flex-wrap items-end gap-6">
				<RadioToggle
					bind:value={showAvailableOnly}
					label="Show"
					labelFalse="All indicators"
					labelTrue="Available only"
					name="availability"
				/>
				<RadioToggle
					bind:value={showCoverageTable}
					label="View"
					labelFalse="Chart"
					labelTrue="Table"
					name="coverageView"
				/>
			</div>

			<LegendBadge />

			{#if showCoverageTable}
				<div class="card bg-base-100 border-base-300 border shadow-sm">
					<div class="card-body rounded-box overflow-hidden p-0">
						<DataTable
							rows={coverageTableRows}
							searchable
							overflow="scroll"
							scrollHeight="500px"
							tableClass="table-sm"
						/>
					</div>
				</div>
			{:else}
				<div class="card bg-base-100 border-base-300 border shadow-sm">
					<div class="card-body rounded-box overflow-hidden p-0">
						<CirclePacking
							data={circlePackingDisplayData}
							flagRow={coverageSelectedRow}
							nodePadding={4}
							paddingByDepth={{ 0: 60, 1: 40, 2: 5, 3: 5 }}
						/>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</section>
