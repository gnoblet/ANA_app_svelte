<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { extent } from 'd3-array';
	import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force';
	import Dot from './primitives/Dot.svelte';
	import XAxis from './primitives/XAxis.svelte';
	import ThresholdLine from './primitives/ThresholdLine.svelte';
	import FlagTooltip from './primitives/FlagTooltip.svelte';
	import Chart, { type Dimensions } from './primitives/Chart.svelte';

	interface DotData {
		uoa: string;
		value: number;
		flagLabel: string;
		within10: boolean | null;
	}

	interface Props {
		threshold: number | null;
		direction: string | null;
		dots: DotData[];
		height?: number;
	}

	let { threshold, direction, dots, height = 120 }: Props = $props();

	// ── Layout ───────────────────────────────────────────────────────────────
	const margin = { top: 12, right: 16, bottom: 28, left: 16 };
	let containerWidth = $state(300);
	const innerWidth = $derived(Math.max(containerWidth - margin.left - margin.right, 40));
	const innerHeight = $derived(Math.max(height - margin.top - margin.bottom, 0));

	const dimensions = $derived<Dimensions>({
		width: containerWidth,
		height,
		margins: margin,
		innerWidth,
		innerHeight
	});

	// ── X scale ──────────────────────────────────────────────────────────────
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

	// ── Beeswarm ─────────────────────────────────────────────────────────────
	const DOT_R = 7;

	const beeswarm = $derived.by(() => {
		const visible = dots.filter((d) => d.flagLabel !== 'no_data');
		if (visible.length === 0) return new Map<string, { x: number; y: number }>();

		const nodes = visible.map((d) => ({
			uoa: d.uoa,
			targetX: xScale(d.value),
			x: xScale(d.value),
			y: midY
		}));

		forceSimulation(nodes)
			.force('x', forceX<(typeof nodes)[number]>((d) => d.targetX).strength(1))
			.force('y', forceY(midY).strength(0.05))
			.force('collide', forceCollide(DOT_R + 1))
			.stop()
			.tick(300);

		const yLo = DOT_R;
		const yHi = innerHeight - DOT_R;
		return new Map(
			nodes.map((n) => [n.uoa, { x: n.x, y: Math.max(yLo, Math.min(yHi, n.y)) }])
		);
	});

	// ── Tooltip ───────────────────────────────────────────────────────────────
	let tooltipDot: DotData | null = $state(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	function handleEnter(e: MouseEvent, dot: DotData) {
		tooltipDot = dot;
		tooltipX = e.clientX;
		tooltipY = e.clientY;
	}

	function handleMove(e: MouseEvent, dot: DotData) {
		tooltipDot = dot;
		tooltipX = e.clientX;
		tooltipY = e.clientY;
	}

	function handleLeave() {
		tooltipDot = null;
	}
</script>

<div class="w-full" bind:clientWidth={containerWidth}>
	<Chart {dimensions}>
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
	</Chart>

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
