<script lang="ts">
	import { onMount } from 'svelte';
	import CirclePackingFlagged from '$lib/components/viz/CirclePackingFlagged.svelte';
	import { flagStore } from '$lib/stores/flagStore.svelte';
	import { loadIndicatorsIntoStore } from '$lib/stores/indicatorsStore.svelte';
	import { resolve, asset } from '$app/paths';
	import Chevron from '$lib/components/ui/Chevron.svelte';
	import NoDataState from '$lib/components/ui/NoDataState.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import RadioToggle from '$lib/components/ui/RadioToggle.svelte';

	let treeData = $state<any>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);
	let selectedUoa = $state('');
	let showAvailableOnly = $state(false);

	const flagged = $derived(flagStore.flaggedResult ?? ([] as Record<string, any>[]));

	const uoaOptions = $derived([...new Set(flagged.map((r) => String(r['uoa'] ?? '')))] as string[]);

	$effect(() => {
		if (uoaOptions.length > 0 && !selectedUoa) {
			selectedUoa = uoaOptions[0] ?? '';
		}
	});

	const selectedRow = $derived(flagged.find((r) => String(r['uoa']) === selectedUoa) ?? null);

	onMount(async () => {
		loadIndicatorsIntoStore();
		try {
			const res = await fetch(asset('/data/indicators-circlepacking.json'));
			if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
			treeData = await res.json();
		} catch (e: any) {
			error = e?.message ?? String(e);
		} finally {
			loading = false;
		}
	});

	/** Prune leaf nodes whose indicator is missing (status === 'no_data') for the given row. */
	function filterAvailable(node: any, row: Record<string, any> | null): any | null {
		if (!node) return null;
		if (node.indicator) {
			const flagLabel = row ? String(row[`${node.id}_status`] ?? 'no_data') : 'no_data';
			return flagLabel === 'no_data' ? null : node;
		}
		if (!node.children) return node;
		const kept = node.children.map((c: any) => filterAvailable(c, row)).filter(Boolean);
		return kept.length > 0 ? { ...node, children: kept } : null;
	}

	const displayData = $derived(
		treeData
			? showAvailableOnly && selectedRow
				? filterAvailable(treeData, selectedRow)
				: treeData
			: null
	);
</script>

{#if loading}
	<div class="flex items-center justify-center py-16">
		<span class="loading loading-spinner loading-lg text-primary"></span>
	</div>
{:else if error}
	<div class="flex flex-col items-center justify-center gap-6 py-12 text-center">
		<p class="text-error">{error}</p>
		<a href={resolve('/')} class="btn btn-primary"><Chevron variant="left" /> Back to Validator</a>
	</div>
{:else if flagged.length === 0}
	<NoDataState />
{:else}
	<div class="flex flex-col gap-4 p-4">
		<!-- Controls row -->
		<div class="grid grid-cols-2 items-end gap-6">
			<!-- UOA selector -->
			<div class="min-w-60">
				<Select
					label="Unit of analysis"
					options={uoaOptions.map((uoa) => ({ value: uoa, label: uoa }))}
					selected={selectedUoa}
					placeholder="Select UOA…"
					onchange={(val) => (selectedUoa = val)}
				/>
			</div>
			<!-- Available-only toggle -->
			<RadioToggle
				bind:value={showAvailableOnly}
				label="Show"
				labelFalse="All indicators"
				labelTrue="Available only"
				name="availability"
			/>
		</div>

		<!-- Legend -->
		<div class="flex flex-wrap items-center gap-4 text-sm">
			<span class="font-medium">Legend:</span>
			<span class="flex items-center gap-1">
				<span class="bg-flag inline-block h-3 w-3 rounded-full"></span>
				Flagged
			</span>
			<span class="flex items-center gap-1">
				<span class="bg-no-flag inline-block h-3 w-3 rounded-full"></span>
				Not flagged
			</span>
			<span class="flex items-center gap-1">
				<span class="bg-no-data inline-block h-3 w-3 rounded-full"></span>
				Missing
			</span>
		</div>

		<CirclePackingFlagged
			data={displayData}
			flagRow={selectedRow}
			nodePadding={4}
			paddingByDepth={{ 0: 60, 1: 40, 2: 5, 3: 5 }}
		/>
	</div>
{/if}
