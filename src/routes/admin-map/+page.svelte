<script lang="ts">
	import { onMount } from 'svelte';
	import { geoPath, geoIdentity } from 'd3-geo';
	import { fetchAdminsForCountry } from '$lib/processing/fetch_admin';
	import { PRELIM_FLAG_BADGE } from '$lib/utils/colors';

	const width = 800;
	const height = 500;

	let adm1: any = $state(null);
	let adm2: any = $state(null);
	const level = 'ADM2';

	const rows = [
		{ uoa: 'SD01004', prelim_flag: 'EM' },
		{ uoa: 'SD01005', prelim_flag: 'ACUTE' },
		{ uoa: 'SD01006', prelim_flag: 'NO_ACUTE_NEEDS' },
		{ uoa: 'SD01007', prelim_flag: 'ROEM' },
		{ uoa: 'SD01008', prelim_flag: 'INSUFFICIENT_EVIDENCE' },
	];

	onMount(async () => {
		const res = await fetchAdminsForCountry('SD01001', 'ADM2');
		adm1 = res?.adm1 ?? null;
		adm2 = res?.adm2 ?? null;
	});

	const flagLookup = new Map(rows.map((r) => [String(r.uoa), r.prelim_flag]));
	const NO_DATA = '#d1d5db';

	function fillForFeature(f: any): string {
		const code = f.properties?.adm2_source_code;
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
		tooltipX = e.clientX + 14;
		tooltipY = e.clientY + 14;
	}

	function onMouseLeave() {
		tooltipFeature = null;
		hoveredFeature = null;
	}

	const tooltipFlag = $derived(
		tooltipFeature
			? flagLookup.get(String(tooltipFeature.properties?.adm2_source_code)) ?? null
			: null
	);

	// ── Projection & paths ────────────────────────────────────────────────────
	const projection = $derived.by(() => {
		if (!adm1) return null;
		return geoIdentity().reflectY(true).fitSize([width, height], adm1);
	});

	const pathGen = $derived(projection ? geoPath(projection) : null);

	const adm1Paths = $derived.by(() => {
		if (!pathGen || !adm1) return [];
		return adm1.features.flatMap((f: any) => {
			const d = pathGen(f);
			return d ? [d] : [];
		});
	});

	const adm2PathItems = $derived.by(() => {
		if (!pathGen || !adm2 || level !== 'ADM2') return [];
		return adm2.features.flatMap((f: any) => {
			const d = pathGen(f);
			return d ? [{ d, f }] : [];
		});
	});
</script>

<!-- Tooltip -->
{#if tooltipFeature}
	<div
		class="pointer-events-none fixed z-50 rounded border border-gray-200 bg-white px-3 py-2 shadow-md"
		style="left:{tooltipX}px; top:{tooltipY}px; min-width:160px;"
	>
		<div class="text-xs text-gray-400">{tooltipFeature.properties?.adm2_source_code}</div>
		<div class="font-semibold">{tooltipFeature.properties?.gis_name}</div>
		{#if tooltipFlag && PRELIM_FLAG_BADGE[tooltipFlag]}
			<div class="mt-1 flex items-center gap-1.5">
				<span
					class="inline-block h-2.5 w-2.5 rounded-sm"
					style="background-color: {PRELIM_FLAG_BADGE[tooltipFlag].bg}"
				></span>
				<span class="text-sm text-gray-600">{PRELIM_FLAG_BADGE[tooltipFlag].label}</span>
			</div>
		{:else}
			<div class="mt-1 text-sm text-gray-400">No data</div>
		{/if}
	</div>
{/if}

<svg {width} {height} style="border:1px solid red; background:white; display:block;">
	{#if level === 'ADM2'}
		{#each adm2PathItems as { d, f }}
			<path
				{d}
				fill={fillForFeature(f)}
				stroke={hoveredFeature === f ? '#000' : '#9ca3af'}
				stroke-width={hoveredFeature === f ? '1.5' : '0.5'}
				vector-effect="non-scaling-stroke"
				onmousemove={(e) => onMouseMove(e, f)}
				onmouseleave={onMouseLeave}
			/>
		{/each}
	{:else}
		{#each adm1Paths as d}
			<path
				{d}
				fill={NO_DATA}
				stroke="#9ca3af"
				stroke-width="0.5"
				vector-effect="non-scaling-stroke"
			/>
		{/each}
	{/if}

	<!-- ADM1 outlines always on top, no pointer events -->
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