<script lang="ts">
	import { onMount } from 'svelte';
	import CirclePacking from '$lib/components/viz/CirclePacking.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import { loadIndicatorsIntoStore, indicatorsStore } from '$lib/stores/indicatorsStore.svelte';
	import { buildIndicatorRows } from '$lib/processing/access_indicators';

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

	// Collect unique values of a given indicator field from all leaf nodes
	function collectField(node: any, field: string): Set<string> {
		const values = new Set<string>();
		if (!node) return values;
		if (node.indicator) {
			const v = node.indicator[field];
			if (v != null) values.add(String(v));
			return values;
		}
		for (const child of node.children ?? []) {
			for (const v of collectField(child, field)) values.add(v);
		}
		return values;
	}

	const levelOptions = $derived(
		data ? [...collectField(data, 'level')].sort().map((l) => ({ value: l, label: l })) : []
	);

	const conceptOptions = $derived(
		data ? [...collectField(data, 'risk_concept')].sort().map((c) => ({ value: c, label: c })) : []
	);

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
	const indicatorsParsed = $derived(buildIndicatorRows(indicatorsStore.indicatorsJson));
</script>

{#if error}
	<p class="text-error">Error loading circle-packing data: {error}</p>
{:else if loading}
	<p>Loading circle-packing data…</p>
{:else}
	<div class="flex flex-col gap-4 p-4">
		<!-- Available-only toggle -->
		<div class="flex items-center gap-3">
			<span class="text-sm font-semibold">Show reference list as</span>
			<div class="join">
				<label
					class="join-item btn btn-sm {!showTableReferenceList ? 'btn-neutral' : 'btn-outline'}"
				>
					<input
						type="radio"
						name="availability"
						class="sr-only"
						checked={!showTableReferenceList}
						onchange={() => (showTableReferenceList = false)}
					/>
					Circle Packing
				</label>
				<label
					class="join-item btn btn-sm {showTableReferenceList ? 'btn-neutral' : 'btn-outline'}"
				>
					<input
						type="radio"
						name="availability"
						class="sr-only"
						checked={showTableReferenceList}
						onchange={() => (showTableReferenceList = true)}
					/>
					Table
				</label>
			</div>
		</div>
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
		<DataTable
			columns={indicatorsParsed.columns}
			data={indicatorsParsed.data}
			searchable
			pageSize={25}
		/>
	{/if}
{/if}
