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

<svelte:head>
	<title>Data Coverage | ANA App</title>
</svelte:head>

<PageHeader
	title="Data Coverage"
	subtitle="Indicator framework coverage for a selected unit of analysis — which indicators have data and which are missing."
>
	{#snippet action()}
		<NavButton href={resolve('/results')} label="Back to Results" direction="back" />
	{/snippet}
</PageHeader>

{#if circlePackingStore.loading}
	<div class="flex items-center justify-center gap-3 py-16">
		<span class="loading loading-spinner loading-md text-primary"></span>
		<p class="text-base-content/60 text-sm">Loading indicator framework…</p>
	</div>
{:else if circlePackingStore.error}
	<div class="flex flex-col items-center justify-center gap-4 py-12 text-center">
		<p class="text-error text-sm">{circlePackingStore.error}</p>
		<NavButton href={resolve('/')} label="Back to Home" direction="back" variant="primary" size="sm" />
	</div>
{:else}
	<DataGuard hasData={flagged.length > 0} variant="none">
		<div class="space-y-4">
			<!-- Controls -->
			<div class="bg-base-200/60 border-base-300 rounded-box border px-5 py-4">
				<div class="flex flex-wrap items-end gap-6">
					<div class="min-w-60 flex-1 max-w-72">
						<Select
							label="Unit of analysis"
							options={uoaOptions.map((uoa) => ({ value: uoa, label: uoa }))}
							selected={selectedUoa}
							placeholder="Select UOA…"
							onchange={(val) => (selectedUoa = Array.isArray(val) ? val[0] : val)}
						/>
					</div>
					<RadioToggle
						bind:value={showAvailableOnly}
						label="Show"
						labelFalse="All indicators"
						labelTrue="Available only"
						name="availability"
					/>
				</div>
			</div>

			<LegendBadge />

			<div class="card bg-base-100 border-base-300 border shadow-sm">
				<div class="card-body p-0 overflow-hidden rounded-box">
					<CirclePacking
						data={displayData}
						flagRow={selectedRow}
						nodePadding={4}
						paddingByDepth={{ 0: 60, 1: 40, 2: 5, 3: 5 }}
					/>
				</div>
			</div>
		</div>
	</DataGuard>
{/if}
