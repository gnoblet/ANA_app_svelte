<script lang="ts">
	import { onMount } from 'svelte';
	import CirclePacking from '$lib/components/viz/CirclePacking.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import { loadIndicatorsIntoStore, indicatorsStore } from '$lib/stores/indicatorsStore.svelte';
	import { buildIndicatorRows } from '$lib/processing/access_indicators';
	import { tidy, filter, distinct, arrange, asc } from '@tidyjs/tidy';
	import RadioToggle from '$lib/components/ui/RadioToggle.svelte';

	let data = $state<any>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);
	let selectedLevels = $state<string[]>([]);
	let selectedConcepts = $state<string[]>([]);
	let showTableReferenceList = $state(false);

	onMount(async () => {
		loadIndicatorsIntoStore();
		try {
			const res = await fetch('/data/indicators-circlepacking.json');
			if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
			data = await res.json();
		} catch (e: any) {
			error = e?.message ?? String(e);
		} finally {
			loading = false;
		}
	});

	// Recursively prune tree to only keep indicators matching all active filters
	function filterTree(node: any, levels: string[], concepts: string[]): any | null {
		if (!node) return null;
		if (node.indicator) {
			const levelOk = levels.length === 0 || levels.includes(node.indicator.level);
			const conceptOk =
				concepts.length === 0 ||
				(node.indicator.risk_concept != null &&
					concepts.includes(String(node.indicator.risk_concept)));
			return levelOk && conceptOk ? node : null;
		}
		if (!node.children) return node;
		const kept = node.children.map((c: any) => filterTree(c, levels, concepts)).filter(Boolean);
		return kept.length > 0 ? { ...node, children: kept } : null;
	}

	const filteredData = $derived(data ? filterTree(data, selectedLevels, selectedConcepts) : null);
	const indicatorObjects = $derived(buildIndicatorRows(indicatorsStore.indicatorsJson));

	const levelOptions = $derived(
		tidy(
			indicatorObjects,
			filter((d) => d.level !== ''),
			distinct(['level']),
			arrange(asc('level'))
		).map((d) => ({ value: d.level, label: d.level }))
	);

	const conceptOptions = $derived(
		tidy(
			indicatorObjects,
			filter((d) => d.risk_concept !== ''),
			distinct(['risk_concept']),
			arrange(asc('risk_concept'))
		).map((d) => ({ value: d.risk_concept, label: d.risk_concept }))
	);

	const filteredTableRows = $derived(
		tidy(
			indicatorObjects,
			filter(
				(d) =>
					(selectedLevels.length === 0 || selectedLevels.includes(d.level)) &&
					(selectedConcepts.length === 0 || selectedConcepts.includes(d.risk_concept))
			)
		)
	);
</script>

{#if error}
	<p class="text-error">Error loading circle-packing data: {error}</p>
{:else if loading}
	<p>Loading circle-packing data…</p>
{:else}
	<div class="flex flex-col gap-4 p-4">
		<!-- Available-only toggle -->
		<RadioToggle
			bind:value={showTableReferenceList}
			label="Show reference list as"
			labelFalse="Circle Packing"
			labelTrue="Table"
			name="reference-list-view"
		/>
		<div class="flex flex-wrap gap-4">
			<div class="min-w-60">
				<Select
					options={levelOptions}
					selected={selectedLevels}
					placeholder="All levels"
					label="Filter by level"
					onchange={(v) => (selectedLevels = v as string[])}
				/>
			</div>
			<div class="min-w-60">
				<Select
					options={conceptOptions}
					selected={selectedConcepts}
					placeholder="All concepts"
					label="Filter by risk concept"
					onchange={(v) => (selectedConcepts = v as string[])}
				/>
			</div>
		</div>
	</div>

	{#if !showTableReferenceList}
		<CirclePacking
			data={filteredData}
			nodePadding={4}
			paddingByDepth={{ 0: 60, 1: 40, 2: 5, 3: 5 }}
		/>
	{:else}
		<DataTable rows={filteredTableRows} searchable pageSize={25} />
	{/if}
{/if}
