<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { geoMercator, geoPath } from 'd3-geo';
	import { zoom, zoomIdentity, type ZoomBehavior, type D3ZoomEvent } from 'd3-zoom';
	import { select } from 'd3-selection';
	import type { Feature, FeatureCollection, Geometry } from 'geojson';
	import { PRELIM_BADGE } from '$lib/utils/colors';
	import { matchFeaturesToUoas } from '$lib/utils/matchFeatures';

	type Row = Record<string, unknown>;
	type GeoFeature = Feature<Geometry, Record<string, unknown>>;
	type GeoFC = FeatureCollection<Geometry, Record<string, unknown>>;

	interface Props {
		/** Full country ADM1 feature collection */
		adm1: GeoFC;
		/** Full country ADM2 feature collection (may be empty if ADM1 UOAs) */
		adm2: GeoFC | null;
		/** Flagged rows — must have `uoa` and `prelim_flag` fields */
		rows: Row[];
		/** ADM level of UOAs in rows */
		level: 'ADM1' | 'ADM2';
	}

	let { adm1, adm2, rows, level }: Props = $props();

	// ── Container sizing ──────────────────────────────────────────────────────
	let containerEl: HTMLDivElement | undefined = $state();
	let svgEl: SVGSVGElement | undefined = $state();
	let width = $state(800);
	let height = $state(500);

	// ── Zoom state ────────────────────────────────────────────────────────────
	let transform = $state('translate(0,0) scale(1)');
	let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;

	function resetZoom() {
		if (!svgEl || !zoomBehavior) return;
		// zoomIdentity = translate(0,0) scale(1) which matches the fitExtent projection
		select(svgEl).transition().duration(400).call(zoomBehavior.transform, zoomIdentity);
	}

	function adjustZoom(factor: number) {
		if (!svgEl || !zoomBehavior) return;
		select(svgEl).transition().duration(200).call(zoomBehavior.scaleBy, factor);
	}

	// ResizeObserver to keep width in sync with container
	onMount(() => {
		if (!containerEl) return;
		const ro = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width ?? 800;
			if (w > 0) width = w;
		});
		ro.observe(containerEl);
		return () => ro.disconnect();
	});

	// Apply zoom behavior once svgEl is mounted
	$effect(() => {
		if (!svgEl) return;
		if (!zoomBehavior) {
			zoomBehavior = zoom<SVGSVGElement, unknown>()
				.scaleExtent([0.5, 20])
				.on('zoom', (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
					transform = e.transform.toString();
				});
			select(svgEl).call(zoomBehavior);
		}
	});

	// ── Debug logging ─────────────────────────────────────────────────────────
	$effect(() => {
		console.log('[PcodeMap] level:', level);
		console.log('[PcodeMap] ADM1 features:', allAdm1Features.length);
		console.log('[PcodeMap] ADM2 features:', allAdm2Features.length);
		console.log(
			'[PcodeMap] UOAs in rows:',
			rows.length,
			rows.map((r) => r.uoa)
		);
		console.log('[PcodeMap] Matched UOAs:', uoaFeatures.size, [...uoaFeatures.keys()]);
		console.log('[PcodeMap] width:', width, 'height:', height, 'pathGen:', !!pathGen);
	});

	// ── UOA → prelim_flag lookup ──────────────────────────────────────────────
	const uoaPrelim = $derived(
		new SvelteMap(rows.map((r) => [String(r.uoa), String(r.prelim_flag ?? '')]))
	);

	// ── Match UOAs to features ────────────────────────────────────────────────
	const uoaFeatures = $derived.by(() => {
		const uoas = rows.map((r) => String(r.uoa));
		const pool = level === 'ADM2' ? (adm2?.features ?? []) : (adm1?.features ?? []);
		return matchFeaturesToUoas(pool as GeoFeature[], uoas, level);
	});

	// Reverse map: feature object identity → UOA string
	const featureToUoa = $derived.by(() => {
		const m = new SvelteMap<GeoFeature, string>();
		for (const [uoa, feat] of uoaFeatures.entries()) m.set(feat, uoa);
		return m;
	});

	// ── D3 projection ── fitExtent so paths are in viewport coords, zoom is additive ─────────────
	const allAdm2Features = $derived(adm2?.features ?? []);
	const allAdm1Features = $derived(adm1?.features ?? []);

	const projection = $derived.by(() => {
		if (allAdm1Features.length === 0 || width === 0) return null;
		const fc = {
			type: 'FeatureCollection' as const,
			features: allAdm1Features as GeoJSON.Feature[]
		};
		return geoMercator().fitExtent(
			[
				[8, 8],
				[width - 8, height - 8]
			],
			fc
		);
	});
	const pathGen = $derived(projection ? geoPath(projection) : null);

	// ── Tooltip state ─────────────────────────────────────────────────────────
	let tooltipUoa = $state<string | null>(null);
	let tooltipPrelim = $state<string | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	function onMouseEnter(e: MouseEvent, uoa: string | null, prelim: string | null) {
		tooltipUoa = uoa;
		tooltipPrelim = prelim;
		tooltipX = e.clientX + 12;
		tooltipY = e.clientY + 12;
	}

	function onMouseMove(e: MouseEvent) {
		tooltipX = e.clientX + 12;
		tooltipY = e.clientY + 12;
	}

	function onMouseLeave() {
		tooltipUoa = null;
		tooltipPrelim = null;
	}

	const NO_DATA_FILL = '#d1d5db'; // gray-300 — visible on white background

	function fillForUoa(uoa: string): string {
		const prelim = uoaPrelim.get(uoa);
		if (!prelim) return NO_DATA_FILL;
		return PRELIM_BADGE[prelim]?.bg ?? NO_DATA_FILL;
	}

	// ── Pre-compute path data (higsch pattern) ────────────────────────────────
	type PathItem = { d: string; uoa: string | null; prelim: string | null; isOutline: boolean };

	const fillPaths = $derived.by((): PathItem[] => {
		if (!pathGen) return [];
		const features = level === 'ADM2' ? allAdm2Features : allAdm1Features;
		return features.flatMap((feat) => {
			const d = pathGen(feat as GeoJSON.Feature);
			if (!d) return [];
			const uoa = featureToUoa.get(feat as GeoFeature) ?? null;
			const prelim = uoa ? (uoaPrelim.get(uoa) ?? null) : null;
			return [{ d, uoa, prelim, isOutline: false }];
		});
	});

	const adm1OutlinePaths = $derived.by((): string[] => {
		if (!pathGen || level !== 'ADM2') return [];
		return allAdm1Features.flatMap((feat) => {
			const d = pathGen(feat as GeoJSON.Feature);
			return d ? [d] : [];
		});
	});
</script>

<!-- Tooltip -->
{#if tooltipUoa}
	<div
		class="border-base-content/10 pointer-events-none fixed z-50 rounded border bg-white px-3 py-2 text-sm shadow-lg"
		style="left:{tooltipX}px; top:{tooltipY}px;"
	>
		<div class="font-semibold">{tooltipUoa}</div>
		{#if tooltipPrelim && PRELIM_BADGE[tooltipPrelim]}
			<div class="mt-0.5 flex items-center gap-1.5">
				<span
					class="inline-block h-2.5 w-2.5 rounded-sm"
					style="background-color: {PRELIM_BADGE[tooltipPrelim].bg}"
				></span>
				<span class="text-base-content/70">{PRELIM_BADGE[tooltipPrelim].label}</span>
			</div>
		{/if}
	</div>
{/if}

<!-- Debug info bar — outside the height-constrained container -->
<div class="text-base-content/50 mb-1 flex flex-wrap gap-3 font-mono text-xs">
	<span>ADM1: <strong>{allAdm1Features.length}</strong></span>
	<span>ADM2: <strong>{allAdm2Features.length}</strong></span>
	<span>Level: <strong>{level}</strong></span>
	<span>UOAs: <strong>{rows.length}</strong></span>
	<span>Matched: <strong>{uoaFeatures.size}</strong></span>
	<span>Paths: <strong>{fillPaths.length}</strong></span>
	<span>W: <strong>{Math.round(width)}</strong>px</span>
</div>

<!-- SVG container — ONLY holds the SVG + absolutely-positioned controls -->
<div bind:this={containerEl} class="relative w-full overflow-hidden" style="height:{height}px">
	<!-- Zoom controls -->
	<div class="absolute top-2 right-2 z-10 flex flex-col gap-1">
		<button
			class="btn btn-xs btn-square btn-ghost border-base-content/20 border bg-white/80"
			onclick={() => adjustZoom(1.5)}
			aria-label="Zoom in">+</button
		>
		<button
			class="btn btn-xs btn-square btn-ghost border-base-content/20 border bg-white/80"
			onclick={() => adjustZoom(1 / 1.5)}
			aria-label="Zoom out">−</button
		>
		<button
			class="btn btn-xs btn-square btn-ghost border-base-content/20 border bg-white/80"
			onclick={resetZoom}
			aria-label="Reset zoom"
			title="Reset"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 16 16"
				width="12"
				height="12"
				fill="currentColor"
			>
				<path
					d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"
				/>
			</svg>
		</button>
	</div>

	{#if pathGen && fillPaths.length > 0}
		<svg
			bind:this={svgEl}
			viewBox="0 0 {width} {height}"
			{width}
			{height}
			style="display:block"
			class="cursor-grab active:cursor-grabbing"
		>
			<g {transform}>
				<!-- Fill layer: ADM2 or ADM1 polygons -->
				{#each fillPaths as { d, uoa, prelim }, i (i)}
					<path
						{d}
						role="img"
						aria-label={uoa ?? 'admin unit'}
						fill={uoa ? fillForUoa(uoa) : NO_DATA_FILL}
						stroke="#9ca3af"
						stroke-width="0.5"
						vector-effect="non-scaling-stroke"
						onmouseenter={(e) => onMouseEnter(e, uoa, prelim)}
						onmousemove={onMouseMove}
						onmouseleave={onMouseLeave}
					/>
				{/each}

				<!-- ADM1 outline layer on top (only when ADM2 level) -->
				{#each adm1OutlinePaths as d, i (i)}
					<path
						{d}
						fill="none"
						stroke="#374151"
						stroke-width="1"
						vector-effect="non-scaling-stroke"
						pointer-events="none"
					/>
				{/each}
			</g>
		</svg>
	{:else if width > 0}
		<div class="text-base-content/40 flex h-full items-center justify-center text-sm">
			Building map…
		</div>
	{/if}
</div>

<!-- Legend — outside the height-constrained container -->
<div class="mt-2 flex flex-wrap gap-3">
	<span class="text-base-content/50 flex items-center gap-1 text-xs">
		<span
			class="border-base-content/20 inline-block h-3 w-3 rounded-sm border"
			style="background-color: {NO_DATA_FILL}"
		></span>No data
	</span>
	{#each Object.entries(PRELIM_BADGE) as [key, badge] (key)}
		<span class="text-base-content/70 flex items-center gap-1 text-xs">
			<span class="inline-block h-3 w-3 rounded-sm" style="background-color: {badge.bg}"
			></span>{badge.label}
		</span>
	{/each}
</div>
