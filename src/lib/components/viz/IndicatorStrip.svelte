<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { extent } from 'd3-array';
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

	// ── Beeswarm — greedy collision-free placement ───────────────────────────
	const DOT_R = 7; // must match Dot.svelte default r

	function beeswarmPositions(
		dotList: DotData[],
		scaleFn: (v: number) => number,
		cy0: number
	): { x: number; y: number }[] {
		const minDist = DOT_R * 2 + 1.5;
		const maxOffset = cy0; // stay within the strip

		// Sort indices by scaled x value
		const order = dotList
			.map((d, i) => ({ i, x: scaleFn(d.value) }))
			.sort((a, b) => a.x - b.x);

		const result: { x: number; y: number }[] = new Array(dotList.length);
		const placed: { x: number; y: number }[] = [];

		for (const { i, x } of order) {
			let chosenY = cy0;
			outer: for (let offset = 0; offset <= maxOffset; offset += minDist) {
				const candidates = offset === 0 ? [cy0] : [cy0 - offset, cy0 + offset];
				for (const cy of candidates) {
					let ok = true;
					for (const p of placed) {
						const dx = x - p.x;
						if (Math.abs(dx) >= minDist) continue;
						if (dx * dx + (cy - p.y) * (cy - p.y) < minDist * minDist) {
							ok = false;
							break;
						}
					}
					if (ok) {
						chosenY = cy;
						break outer;
					}
				}
			}
			result[i] = { x, y: chosenY };
			placed.push({ x, y: chosenY });
		}
		return result;
	}

	const beeswarm = $derived(beeswarmPositions(dots, (v) => xScale(v), midY));

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
		class="overflow-visible"
	>
		<g transform="translate({margin.left},{margin.top})">
			<XAxis scale={xScale} {innerWidth} {innerHeight} />

			{#if threshold !== null}
				<ThresholdLine x={xScale(threshold)} height={innerHeight} />
			{/if}

			{#each dots as dot, i (dot.uoa)}
				{#if dot.flagLabel !== 'no_data'}
					<Dot
						cx={beeswarm[i].x}
						cy={beeswarm[i].y}
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
