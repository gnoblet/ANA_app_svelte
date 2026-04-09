<script lang="ts">
	import { pie, arc } from 'd3-shape';
	import { PRELIM_FLAG_BADGE } from '$lib/utils/colors';
	import TooltipCard from '$lib/components/ui/TooltipCard.svelte';
	import ButtonClear from '$lib/components/ui/ButtonClear.svelte';

	type Row = Record<string, any>;

	interface Props {
		rows: Row[];
		/** Outer radius in px. Auto-fits to container if omitted. */
		radius?: number | null;
		/** Currently selected keys (null = all). Driven externally. */
		selectedKeys?: string[] | null;
		/** Called when a slice is clicked — passes the key or null to deselect. */
		onsliceclick?: (key: string | null) => void;
	}

	let { rows, radius = null, selectedKeys = null, onsliceclick }: Props = $props();

	// ── Responsive container width ────────────────────────────────────────────
	let containerWidth = $state(220);

	// Radius: explicit override or auto-fit to container (max 120px)
	const effectiveRadius = $derived(radius ?? Math.min(Math.floor(containerWidth / 2.8), 120));

	const PRELIM_KEYS = ['EM', 'ROEM', 'ACUTE', 'NO_ACUTE_NEEDS', 'INSUFFICIENT_EVIDENCE', 'NO_DATA'];

	// ── Count rows per prelim_flag ────────────────────────────────────────────
	interface Slice {
		key: string;
		count: number;
		label: string;
		color: string;
	}

	const slices = $derived.by<Slice[]>(() => {
		const counts: Record<string, number> = {};
		for (const k of PRELIM_KEYS) counts[k] = 0;
		for (const row of rows) {
			const k = String(row.prelim_flag ?? '');
			if (k in counts) counts[k]++;
		}
		return PRELIM_KEYS.filter((k) => counts[k] > 0).map((k) => ({
			key: k,
			count: counts[k],
			label: PRELIM_FLAG_BADGE[k]?.label ?? k,
			color: PRELIM_FLAG_BADGE[k]?.bg ?? '#9ca3af'
		}));
	});

	// ── D3 pie + arc math (geometry only, no DOM) ─────────────────────────────
	const innerRadius = $derived(effectiveRadius * 0.52);
	const outerRadius = $derived(effectiveRadius);
	const cx = $derived(effectiveRadius + 4);
	const cy = $derived(effectiveRadius + 4);
	const svgSize = $derived((effectiveRadius + 4) * 2);

	const pieGen = $derived(
		pie<Slice>()
			.value((d) => d.count)
			.sort(null)
			.padAngle(0.02)
	);

	const arcGen = $derived(
		arc<ReturnType<typeof pieGen>[number]>()
			.innerRadius(innerRadius)
			.outerRadius(outerRadius)
			.cornerRadius(3)
	);

	const arcHoverGen = $derived(
		arc<ReturnType<typeof pieGen>[number]>()
			.innerRadius(innerRadius)
			.outerRadius(outerRadius + 8)
			.cornerRadius(3)
	);

	const arcData = $derived(slices.length > 0 ? pieGen(slices) : []);

	// ── Tooltip ───────────────────────────────────────────────────────────────
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let hoveredKey = $state<string | null>(null);

	function showSliceTooltip(e: MouseEvent, d: (typeof arcData)[number]) {
		tooltipX = e.clientX;
		tooltipY = e.clientY;
		hoveredKey = d.data.key;
		tooltipVisible = true;
	}

	function moveTooltip(e: MouseEvent) {
		tooltipX = e.clientX;
		tooltipY = e.clientY;
	}

	function hideTooltip() {
		tooltipVisible = false;
		hoveredKey = null;
	}

	function handleSliceClick(key: string) {
		if (!onsliceclick) return;
		// Toggle: clicking already-selected key deselects it
		if (selectedKeys?.length === 1 && selectedKeys[0] === key) {
			onsliceclick(null);
		} else {
			onsliceclick(key);
		}
	}

	const hoveredSlice = $derived(arcData.find((d) => d.data.key === hoveredKey) ?? null);

	function isActive(key: string): boolean {
		return selectedKeys === null || selectedKeys.includes(key);
	}
</script>

{#if tooltipVisible && hoveredSlice}
	<TooltipCard
		title={hoveredSlice.data.label}
		x={tooltipX}
		y={tooltipY}
		rows={[
			{ key: 'Count', value: String(hoveredSlice.data.count) },
			{
				key: 'Share',
				value: `${Math.round((hoveredSlice.data.count / rows.length) * 100)}%`
			}
		]}
		swatches={[{ color: hoveredSlice.data.color, label: hoveredSlice.data.label }]}
	/>
{/if}

<div class="card bg-base-100 border-base-300/40 border shadow-sm" bind:offsetWidth={containerWidth}>
	<div class="card-body">
		<h2 class="card-title">How many UOAs per preliminary flag category</h2>
		<span class="mb-2">
			Click a slice to filter.
			<span class="ml-2">
				{#if selectedKeys !== null}
					<ButtonClear label="Clear filter" size="xs" onclick={() => onsliceclick?.(null)} />
				{/if}
			</span>
		</span>

		{#if rows.length === 0}
			<p class="text-base-content/70 py-8 text-center text-sm">No data matches current filters.</p>
		{:else}
			<div class="flex flex-1 items-center justify-center gap-6">
				<!-- Donut SVG — D3 arc paths, Svelte renders DOM -->
				<svg width={svgSize} height={svgSize} style="display:block; overflow:visible">
					<g transform="translate({cx},{cy})">
						{#each arcData as d (d.data.key)}
							{@const isHov = hoveredKey === d.data.key}
							{@const active = isActive(d.data.key)}
							{@const pathD = (isHov ? arcHoverGen(d) : arcGen(d)) ?? ''}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<path
								d={pathD}
								fill={d.data.color}
								opacity={active ? 1 : 0.25}
								style="transition: opacity 0.15s, d 0.1s; cursor: {onsliceclick
									? 'pointer'
									: 'default'}"
								onmousemove={(e) => {
									showSliceTooltip(e, d);
									moveTooltip(e);
								}}
								onmouseleave={hideTooltip}
								onclick={() => handleSliceClick(d.data.key)}
							/>
						{/each}
						<!-- Centre label -->
						<text
							text-anchor="middle"
							dy="-0.3em"
							style="font-size: 1.4rem; font-weight: 700; fill: currentColor">{rows.length}</text
						>
						<text text-anchor="middle" dy="1.1em" style="font-size: 0.7rem; fill: currentColor;"
							>UOAs</text
						>
					</g>
				</svg>

				<!-- Legend list -->
				<div class="flex flex-col items-start">
					{#each slices as s (s.key)}
						{@const active = isActive(s.key)}
						<button
							class="btn btn-ghost hover:bg-base-200"
							onclick={() => handleSliceClick(s.key)}
							aria-label="Filter by {s.label}"
						>
							<span class="h-3 w-3 rounded-full" style:background-color={s.color}></span>
							<span class="font-bold">{s.count}</span>
							<span> {s.label}</span>
							<span class="text-base-content/70">
								{Math.round((s.count / rows.length) * 100)}%
							</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
