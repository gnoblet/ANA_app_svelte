<script lang="ts">
	import SystemHeatmap from '$lib/components/viz/SystemHeatmap.svelte';
	import DrilldownTable from '$lib/components/viz/DrilldownTable.svelte';
	import { getIndicatorMetadata, getFactorMetadata } from '$lib/engine/indicatorMetadata';
	import { tick } from 'svelte';

	type Row = Record<string, any>;
	type System = { id: string; label: string };
	type FactorBlock = { factorKey: string; factorLabel: string; indicatorIds: string[] };

	interface Props {
		rows: Row[];
		systems: System[];
		systemCodes: Map<string, string[]>;
		subList: { path: string; codes: string[] }[];
		indicatorsJson: any;
	}

	let { rows, systems, systemCodes, subList, indicatorsJson }: Props = $props();

	// ── Selection state ───────────────────────────────────────────────────────
	let selectedUoa: string | null = $state(null);
	let selectedSystem: string | null = $state(null);

	/** Clears selection automatically when the selected UOA is no longer in rows. */
	const activeUoa = $derived(
		selectedUoa !== null && rows.some((r) => String(r.uoa) === selectedUoa) ? selectedUoa : null
	);
	const activeSystem = $derived(activeUoa !== null ? selectedSystem : null);

	async function onselect(uoa: string, systemId: string) {
		selectedUoa = uoa;
		selectedSystem = systemId;
		await tick();
		document
			.getElementById('drilldown-table')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// ── Helpers ───────────────────────────────────────────────────────────────
	function factorBlocksFor(systemId: string): FactorBlock[] {
		const byFactor = new Map<string, Set<string>>();
		for (const { path, codes } of subList) {
			const parts = String(path).split('.');
			if (parts[0] !== systemId) continue;
			const factorKey = `${parts[0]}.${parts[1]}`;
			if (!byFactor.has(factorKey)) byFactor.set(factorKey, new Set());
			for (const c of codes) byFactor.get(factorKey)!.add(c);
		}
		return Array.from(byFactor.entries()).map(([k, set]) => {
			const [sysId, facId] = k.split('.');
			const md = getFactorMetadata(indicatorsJson, sysId, facId) as any;
			return {
				factorKey: k,
				factorLabel: md?.factor_label ?? facId,
				indicatorIds: Array.from(set)
			};
		});
	}

	function indicatorInfo(id: string) {
		if (!indicatorsJson) return null;
		const md = getIndicatorMetadata(indicatorsJson, id) as any;
		if (!md) return null;
		return {
			label: md.raw?.metric ?? md.raw?.indicator_label ?? id,
			threshold_an: md.raw?.thresholds?.an ?? null,
			threshold_van: md.raw?.thresholds?.van ?? null,
			above_or_below: md.raw?.above_or_below ?? null,
			preference: md.raw?.preference ?? null
		};
	}

	function fmt(v: any): string {
		if (v === null || v === undefined) return '–';
		if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
		return String(v);
	}

	function systemLabel(systemId: string): string {
		return systems.find((s) => s.id === systemId)?.label ?? systemId;
	}

	function rowFor(uoa: string): Row | undefined {
		return rows.find((r) => String(r.uoa) === uoa);
	}
</script>

<SystemHeatmap {rows} {systems} {systemCodes} {activeUoa} {activeSystem} {onselect} />

{#if activeUoa && activeSystem}
	{@const drillRow = rowFor(activeUoa)}
	{#if drillRow}
		<div id="drilldown-table">
			<DrilldownTable
				uoa={activeUoa}
				systemLabel={systemLabel(activeSystem)}
				row={drillRow}
				factorBlocks={factorBlocksFor(activeSystem)}
				{indicatorInfo}
				{fmt}
			/>
		</div>
	{/if}
{/if}
