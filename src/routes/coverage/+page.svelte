<script lang="ts">
	import { onMount } from 'svelte';
	import CirclePacking from '$lib/components/viz/CirclePacking.svelte';
	import { flagStore } from '$lib/stores/flagStore.svelte';
	import { loadIndicatorsIntoStore } from '$lib/stores/indicatorsStore.svelte';
	import { resolve, asset } from '$app/paths';
	import NavButton from '$lib/components/ui/NavButton.svelte';
	import DataGuard from '$lib/components/ui/DataGuard.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import RadioToggle from '$lib/components/ui/RadioToggle.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import LegendBadge from '$lib/components/ui/LegendBadge.svelte';

	import { circlePackingStore, loadCirclePackingData } from '$lib/stores/circlePackingStore.svelte';
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

	onMount(() => {
		loadIndicatorsIntoStore();
		loadCirclePackingData(asset('/data/indicators-circlepacking.json'));
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
		circlePackingStore.data
			? showAvailableOnly && selectedRow
				? filterAvailable(circlePackingStore.data, selectedRow)
				: circlePackingStore.data
			: null
	);
</script>

<PageHeader
	title="Input Data: Circle Packing"
	subtitle="Visualize your flagged data against the indicator framework."
>
	{#snippet action()}
		<NavButton href={resolve('/results')} label="Back to Results" direction="back" />
	{/snippet}
</PageHeader>

{#if circlePackingStore.loading}
	<div class="flex items-center justify-center py-16">
		<span class="loading loading-spinner loading-lg text-primary"></span>
	</div>
{:else if circlePackingStore.error}
	<div class="flex flex-col items-center justify-center gap-6 py-12 text-center">
		<p class="text-error">{circlePackingStore.error}</p>
		<NavButton href={resolve('/')} label="Back to Validator" direction="back" variant="primary" />
	</div>
{:else}
	<DataGuard hasData={flagged.length > 0} variant="none">
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
						onchange={(val) => (selectedUoa = Array.isArray(val) ? val[0] : val)}
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

			<LegendBadge />

			<CirclePacking
				data={displayData}
				flagRow={selectedRow}
				nodePadding={4}
				paddingByDepth={{ 0: 60, 1: 40, 2: 5, 3: 5 }}
			/>
		</div>
	</DataGuard>
{/if}
