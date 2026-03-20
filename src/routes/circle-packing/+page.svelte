<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import CirclePacking from '$lib/components/viz/CirclePacking.svelte';
	import Select from '$lib/components/viz/Select.svelte';

	let data: any = null;
	let error: string | null = null;
	let loading = true;
	let selectedLevels: string[] = [];
	let selectedConcepts: string[] = [];

	onMount(async () => {
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

	$: levelOptions = data
		? [...collectField(data, 'level')].sort().map((l) => ({ value: l, label: l }))
		: [];

	$: conceptOptions = data
		? [...collectField(data, 'risk_concept')].sort().map((c) => ({ value: c, label: c }))
		: [];

	// Recursively prune tree to only keep indicators matching all active filters
	function filterTree(node: any, levels: string[], concepts: string[]): any | null {
		if (!node) return null;
		if (node.indicator) {
			const levelOk = levels.length === 0 || levels.includes(node.indicator.level);
			const conceptOk = concepts.length === 0 || (node.indicator.risk_concept != null && concepts.includes(String(node.indicator.risk_concept)));
			return levelOk && conceptOk ? node : null;
		}
		if (!node.children) return node;
		const kept = node.children.map((c: any) => filterTree(c, levels, concepts)).filter(Boolean);
		return kept.length > 0 ? { ...node, children: kept } : null;
	}

	$: filteredData = data ? filterTree(data, selectedLevels, selectedConcepts) : null;
</script>

{#if error}
	<p class="text-red-600">Error loading circle-packing data: {error}</p>
{:else if loading}
	<p>Loading circle-packing data…</p>
{:else}
	<div class="flex flex-col gap-4 p-4">
		<div class="flex flex-wrap gap-4">
			<div class="min-w-48">
				<Select
					options={levelOptions}
					selected={selectedLevels}
					placeholder="All levels"
					label="Filter by level"
					onchange={(v) => (selectedLevels = v as string[])}
				/>
			</div>
			<div class="min-w-48">
				<Select
					options={conceptOptions}
					selected={selectedConcepts}
					placeholder="All concepts"
					label="Filter by risk concept"
					onchange={(v) => (selectedConcepts = v as string[])}
				/>
			</div>
		</div>

		{#key filteredData}
			<div in:fade={{ duration: 400, delay: 50 }} out:fade={{ duration: 200 }}>
				<CirclePacking
					data={filteredData}
					nodePadding={4}
					paddingByDepth={{ 0: 60, 1: 40, 2: 5, 3: 5 }}
				/>
			</div>
		{/key}
	</div>
{/if}
