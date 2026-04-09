<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { extent } from 'd3-array';
	import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force';
	import Dot from './primitives/Dot.svelte';
	import XAxis from './primitives/XAxis.svelte';
	import ThresholdLine from './primitives/ThresholdLine.svelte';
	import FlagTooltip from './primitives/FlagTooltip.svelte';

	interface DotData {
		uoa: string;
		value: number;
		flagLabel: string;
		within10: boolean | null;
	}

	interface Props {
		indicatorLabel: string;
		threshold: number | null;
		direction: string | null;
		dots: DotData[];
		height?: number;
	}

	let { indicatorLabel, threshold, direction, dots, height = 80 }: Props = $props();

	// ── Layout ───────────────────────────────────────────────────────────────
	const margin = { top: 12, right: 16, bottom: 28, left: 16 };
	let containerWidth = $state(300);
	const innerWidth = $derived(Math.max(containerWidth - margin.left - margin.right, 40));
	const innerHeight = $derived(height - margin.top - margin.bottom);

	// ── X domain ─────────────────────────────────────────────────────────────
	function computeDomain(dotList: DotData[], thr: number | null): [number, number] {
		const vals = dotList.filter((d) => d.flagLabel !== 'no_data').map((d) => d.value);
		if (vals.length === 0) return [0, 1];
		const ext = extent(vals);
		let lo = ext[0] ?? 0;
		let hi = ext[1] ?? 1;
		if (thr !== null) {
			lo = Math.min(lo, thr);
			hi = Math.max(hi, thr);
		}
		const pad = (hi - lo) * 0.15 || Math.abs(lo) * 0.15 || 1;
		return [lo - pad, hi + pad];
	}

	const xDomain = $derived(computeDomain(dots, threshold));
	const xScale = $derived(scaleLinear().domain(xDomain).range([0, innerWidth]).nice());

	const midY = $derived(innerHeight / 2);

	// ── Beeswarm — d3-force synchronous simulation ───────────────────────────
	const DOT_R = 7; // must match Dot.svelte default r

	function beeswarmPositions(
		dotList: DotData[],
		scaleFn: (v: number) => number,
		cy0: number,
		yMax: number
	): Map<string, { x: number; y: number }> {
		const visible = dotList.filter((d) => d.flagLabel !== 'no_data');
		if (visible.length === 0) return new Map();

		const nodes = visible.map((d) => ({
			uoa: d.uoa,
			targetX: scaleFn(d.value),
			x: scaleFn(d.value),
			y: cy0
		}));

		forceSimulation(nodes)
			.force('x', forceX<(typeof nodes)[number]>((d) => d.targetX).strength(1))
			.force('y', forceY(cy0).strength(0.5))
			.force('collide', forceCollide(DOT_R + 1))
			.stop()
			.tick(300);

		const yLo = DOT_R;
		const yHi = yMax - DOT_R;
		return new Map(
			nodes.map((n) => [n.uoa, { x: n.x, y: Math.max(yLo, Math.min(yHi, n.y)) }])
		);
	}

	const beeswarm = $derived(beeswarmPositions(dots, (v) => xScale(v), midY, innerHeight));

	// ── Tooltip state ────────────────────────────────────────────────────────
	let tooltipDot: DotData | null = $state(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	function updatePos(e: MouseEvent) {
		tooltipX = e.clientX;
		tooltipY = e.clientY;
	}

	function handleEnter(e: MouseEvent, dot: DotData) {
		tooltipDot = dot;
		updatePos(e);
	}

	function handleMove(e: MouseEvent, dot: DotData) {
		tooltipDot = dot;
		updatePos(e);
	}

	function handleLeave() {
		tooltipDot = null;
	}
</script>

<div class="w-full" bind:clientWidth={containerWidth}>
	<svg
		width={containerWidth}
		{height}
		role="img"
		aria-label="Strip chart for {indicatorLabel}"
	>
		<g transform="translate({margin.left},{margin.top})">
			<XAxis scale={xScale} {innerWidth} {innerHeight} />

			{#if threshold !== null}
				<ThresholdLine x={xScale(threshold)} height={innerHeight} />
			{/if}

			{#each dots as dot (dot.uoa)}
				{@const pos = beeswarm.get(dot.uoa)}
				{#if pos}
					<Dot
						cx={pos.x}
						cy={pos.y}
						flagLabel={dot.flagLabel}
						within10={dot.within10}
						onmouseenter={(e) => handleEnter(e, dot)}
						onmousemove={(e) => handleMove(e, dot)}
						onmouseleave={handleLeave}
					/>
				{/if}
			{/each}
		</g>
	</svg>

	{#if tooltipDot}
		<FlagTooltip
			uoa={tooltipDot.uoa}
			value={tooltipDot.value}
			{threshold}
			{direction}
			flagLabel={tooltipDot.flagLabel}
			within10={tooltipDot.within10}
			x={tooltipX}
			y={tooltipY}
		/>
	{/if}
</div>
