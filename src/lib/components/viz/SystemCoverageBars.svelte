<script lang="ts">
	import { scaleLinear, scaleBand } from 'd3-scale';
	import { FLAG_BADGE, systemBaseColor } from '$lib/utils/colors';
	import TooltipCard from '$lib/components/ui/TooltipCard.svelte';

	type Row = Record<string, any>;

	interface Props {
		rows: Row[];
		systems: { id: string; label: string }[];
		systemCodes: Map<string, string[]>;
	}

	let { rows, systems }: Props = $props();

	// ── Per-system status counts ──────────────────────────────────────────────
	const STATUS_KEYS = ['flag', 'no_flag', 'insufficient_evidence', 'no_data'] as const;
	type StatusKey = (typeof STATUS_KEYS)[number];

	interface SystemBar {
		id: string;
		label: string;
		counts: Record<StatusKey, number>;
		total: number;
	}

	const bars = $derived.by<SystemBar[]>(() => {
		return systems.map((sys) => {
			const counts: Record<StatusKey, number> = {
				flag: 0,
				no_flag: 0,
				insufficient_evidence: 0,
				no_data: 0
			};
			for (const row of rows) {
				const status = String(row[`${sys.id}.status`] ?? 'no_data') as StatusKey;
				if (status in counts) counts[status]++;
				else counts.no_data++;
			}
			return { id: sys.id, label: sys.label, counts, total: rows.length };
		});
	});

	// ── D3 scales (geometry math, no DOM) ────────────────────────────────────
	const BAR_HEIGHT = 28;
	const LABEL_WIDTH = 148;
	const RIGHT_MARGIN = 40;

	let containerWidth = $state(600);

	function observeWidth(node: HTMLElement) {
		containerWidth = node.offsetWidth;
		const ro = new ResizeObserver((entries) => {
			containerWidth = entries[0]?.contentRect.width ?? containerWidth;
		});
		ro.observe(node);
		return () => ro.disconnect();
	}

	const barWidth = $derived(Math.max(0, containerWidth - LABEL_WIDTH - RIGHT_MARGIN));

	const xScale = $derived(
		scaleLinear()
			.domain([0, rows.length || 1])
			.range([0, barWidth])
	);

	const yScale = $derived(
		scaleBand()
			.domain(systems.map((s) => s.id))
			.range([0, systems.length * (BAR_HEIGHT + 8)])
			.padding(0.2)
	);

	const svgHeight = $derived(systems.length * (BAR_HEIGHT + 8) + 24);

	// Stacked x offsets per bar
	function stackedSegments(bar: SystemBar) {
		let x = 0;
		return STATUS_KEYS.map((sk) => {
			const w = xScale(bar.counts[sk]);
			const seg = { key: sk, x, width: w, count: bar.counts[sk] };
			x += w;
			return seg;
		}).filter((seg) => seg.width > 0);
	}

	// ── Tooltip ───────────────────────────────────────────────────────────────
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipBar = $state<SystemBar | null>(null);

	function showBarTooltip(e: MouseEvent, bar: SystemBar) {
		tooltipBar = bar;
		tooltipX = e.clientX;
		tooltipY = e.clientY;
		tooltipVisible = true;
	}

	function moveTooltip(e: MouseEvent) {
		tooltipX = e.clientX;
		tooltipY = e.clientY;
	}

	function hideTooltip() {
		tooltipVisible = false;
		tooltipBar = null;
	}
</script>

{#if tooltipVisible && tooltipBar}
	<TooltipCard
		title={tooltipBar.label}
		x={tooltipX}
		y={tooltipY}
		swatches={STATUS_KEYS.filter((sk) => tooltipBar!.counts[sk] > 0).map((sk) => ({
			color: `var(${FLAG_BADGE[sk].tintVar})`,
			label: `${FLAG_BADGE[sk].label}: ${tooltipBar!.counts[sk]}`
		}))}
	/>
{/if}

<div class="card bg-base-100 border-base-300/40 border shadow-sm">
	<div class="card-body">
		<h2 class="card-title">System coverage overview</h2>
		<p class="text-base-content/60 mb-2 text-sm">
			UOA counts by flag status for each system. Hover for details.
		</p>

		{#if rows.length === 0}
			<p class="text-base-content/40 py-8 text-center text-sm">No data matches current filters.</p>
		{:else}
		<div class="w-full" {@attach observeWidth}>
			<svg width={containerWidth} height={svgHeight}>
				<g transform="translate({LABEL_WIDTH},12)">
					{#each bars as bar (bar.id)}
						{@const y = yScale(bar.id) ?? 0}
						{@const bh = yScale.bandwidth()}
						{@const sysColor = systemBaseColor(bar.id)}
						{@const segs = stackedSegments(bar)}

						<!-- System label -->
						<text
							x={-8}
							y={y + bh / 2}
							text-anchor="end"
							dominant-baseline="middle"
							style="font-size: 0.75rem; fill: currentColor"
							class="fill-base-content"
						>
							<tspan style="fill: {sysColor}; font-weight: 700">●</tspan>
							{bar.label}
						</text>

						<!-- Stacked segments -->
						{#each segs as seg (seg.key)}
							{@const fb = FLAG_BADGE[seg.key]}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<rect
								x={seg.x}
								{y}
								width={seg.width}
								height={bh}
								style="fill: var({fb.tintVar}); cursor: default"
								rx="2"
								onmousemove={(e) => {
									showBarTooltip(e, bar);
									moveTooltip(e);
								}}
								onmouseleave={hideTooltip}
							/>
							<!-- Count label inside segment (if wide enough) -->
							{#if seg.width > 22}
								<text
									x={seg.x + seg.width / 2}
									y={y + bh / 2}
									text-anchor="middle"
									dominant-baseline="middle"
									style="font-size: 0.65rem; font-weight: 600; pointer-events: none"
									class="fill-base-content/70">{seg.count}</text
								>
							{/if}
						{/each}

						<!-- Total label on right -->
						<text
							x={barWidth + 6}
							y={y + bh / 2}
							dominant-baseline="middle"
							style="font-size: 0.7rem"
							class="fill-base-content/50">{bar.total}</text
						>
					{/each}
				</g>
			</svg>
		</div>
		{/if}
	</div>
</div>
