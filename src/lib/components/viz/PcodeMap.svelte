<script lang="ts">
	import { tick } from 'svelte';
	import { geoPath, geoIdentity } from 'd3-geo';
	import type { FeatureCollection, Geometry } from 'geojson';
	import { PRELIM_FLAG_BADGE } from '$lib/utils/colors';
	import TooltipCard from '$lib/components/ui/TooltipCard.svelte';

	type Row = Record<string, unknown>;
	type GeoFC = FeatureCollection<Geometry, Record<string, unknown>>;

	interface Props {
		adm1: GeoFC;
		adm2: GeoFC | null;
		rows: Row[];
		level: 'ADM1' | 'ADM2';
		/** Called with the UOA code when the user clicks an admin area. */
		onuoaclick?: (uoa: string) => void;
	}

	let { adm1, adm2, rows, level, onuoaclick }: Props = $props();

	// ── Container sizing ──────────────────────────────────────────────────────
	let containerEl: HTMLDivElement | undefined = $state();
	let width = $state(0);
	const height = 500;

	$effect(() => {
		if (!containerEl) return;
		tick().then(() => {
			if (!containerEl) return;
			width = containerEl.offsetWidth;
		});
		const ro = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width ?? 0;
			if (w > 0) width = w;
		});
		ro.observe(containerEl);
		return () => ro.disconnect();
	});

	// ── Flag lookup ───────────────────────────────────────────────────────────
	const flagLookup = $derived(
		new Map(rows.map((r) => [String(r.uoa), String(r.prelim_flag ?? '')]))
	);

	const NO_DATA = '#d1d5db';

	function fillForFeature(f: any): string {
		const code =
			level === 'ADM2'
				? f.properties?.adm2_source_code
				: (f.properties?.adm1_source_code ?? f.properties?.pcode);
		if (!code) return NO_DATA;
		const flag = flagLookup.get(String(code));
		if (!flag) return NO_DATA;
		return PRELIM_FLAG_BADGE[flag]?.bg ?? NO_DATA;
	}

	// ── Tooltip & hover ───────────────────────────────────────────────────────
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipFeature: any = $state(null);
	let hoveredFeature: any = $state(null);

	function onMouseMove(e: MouseEvent, f: any) {
		tooltipFeature = f;
		hoveredFeature = f;
		tooltipX = e.clientX;
		tooltipY = e.clientY;
	}

	function onMouseLeave() {
		tooltipFeature = null;
		hoveredFeature = null;
	}

	const tooltipFlag = $derived(
		tooltipFeature
			? (flagLookup.get(
					String(
						level === 'ADM2'
							? tooltipFeature.properties?.adm2_source_code
							: (tooltipFeature.properties?.adm1_source_code ?? tooltipFeature.properties?.pcode)
					)
				) ?? null)
			: null
	);

	const tooltipName = $derived(
		tooltipFeature?.properties?.gis_name ?? tooltipFeature?.properties?.name ?? null
	);

	const tooltipCode = $derived(
		tooltipFeature
			? level === 'ADM2'
				? tooltipFeature.properties?.adm2_source_code
				: (tooltipFeature.properties?.adm1_source_code ?? tooltipFeature.properties?.pcode)
			: null
	);

	// ── Projection & paths ────────────────────────────────────────────────────
	const projection = $derived.by(() => {
		if (!adm1?.features?.length || width < 10) return null;
		return geoIdentity().reflectY(true).fitSize([width, height], adm1);
	});

	const pathGen = $derived(projection ? geoPath(projection) : null);

	const adm1Paths = $derived.by(() => {
		if (!pathGen || !adm1) return [];
		return adm1.features.flatMap((f) => {
			const d = pathGen(f as any);
			return d ? [d] : [];
		});
	});

	const fillPathItems = $derived.by(() => {
		if (!pathGen) return [];
		const features = level === 'ADM2' ? (adm2?.features ?? []) : (adm1?.features ?? []);
		return features.flatMap((f) => {
			const d = pathGen(f as any);
			return d ? [{ d, f }] : [];
		});
	});

	const adm2PathItems = $derived.by(() => {
		if (!pathGen || level !== 'ADM2' || !adm2?.features?.length) return [];
		return adm2.features.flatMap((f) => {
			const d = pathGen(f as any);
			return d ? [{ d, f }] : [];
		});
	});
</script>

<!-- Tooltip -->
{#if tooltipFeature}
	{@const flagBadge =
		tooltipFlag && PRELIM_FLAG_BADGE[tooltipFlag] ? PRELIM_FLAG_BADGE[tooltipFlag] : null}
	<TooltipCard
		title={tooltipName ?? tooltipCode ?? ''}
		rows={tooltipCode && tooltipName ? [{ key: 'Code', value: String(tooltipCode) }] : []}
		swatches={flagBadge
			? [{ color: flagBadge.bg, label: flagBadge.label }]
			: [{ color: '#d1d5db', label: 'No data' }]}
		x={tooltipX}
		y={tooltipY}
	/>
{/if}

<div bind:this={containerEl} class="w-full" style="height:{height}px">
	{#if pathGen}
		<svg {width} {height} style="display:block;">
			<!-- Fill + interactive layer -->
			{#each fillPathItems as { d, f }}
				{@const featureCode =
					level === 'ADM2'
						? f.properties?.adm2_source_code
						: (f.properties?.adm1_source_code ?? f.properties?.pcode)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<path
					{d}
					fill={fillForFeature(f)}
					stroke={hoveredFeature === f ? '#000' : '#9ca3af'}
					stroke-width={hoveredFeature === f ? '1.5' : '0.5'}
					vector-effect="non-scaling-stroke"
					style={onuoaclick ? 'cursor: pointer' : ''}
					onmousemove={(e) => onMouseMove(e, f)}
					onmouseleave={onMouseLeave}
					onclick={() => featureCode && onuoaclick?.(String(featureCode))}
				/>
			{/each}

			<!-- ADM1 outlines always on top -->
			{#each adm1Paths as d}
				<path
					{d}
					fill="none"
					stroke="#374151"
					stroke-width="1.5"
					vector-effect="non-scaling-stroke"
					pointer-events="none"
				/>
			{/each}
		</svg>
	{/if}
</div>

<!-- Legend -->
<div class="mt-2 flex flex-wrap gap-3">
	{#each Object.entries(PRELIM_FLAG_BADGE) as [key, badge] (key)}
		<span class="flex items-center gap-1 text-xs text-gray-600">
			<span class="inline-block h-3 w-3 rounded-sm" style="background-color:{badge.bg}"></span>
			{badge.label}
		</span>
	{/each}
</div>
