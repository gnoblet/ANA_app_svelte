<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { extent } from 'd3-array';
	import Dot from './primitives/Dot.svelte';
	import XAxis from './helpers/XAxis.svelte';
	import ThresholdLine from './helpers/ThresholdLine.svelte';
	import FlagTooltip from './helpers/FlagTooltip.svelte';

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

	// ── Jitter — seeded by index so positions are stable across re-renders ───
	function seededJitter(index: number, amplitude: number): number {
		const s = Math.sin(index * 127.1 + 311.7) * 43758.5453;
		return (s - Math.floor(s) - 0.5) * 2 * amplitude;
	}

	const jitterAmp = $derived(innerHeight * 0.38);
	const midY = $derived(innerHeight / 2);

	// ── Tooltip state ────────────────────────────────────────────────────────
	let tooltipDot: DotData | null = $state(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	function updatePos(e: MouseEvent) {
		const svg = (e.currentTarget as Element).closest('svg');
		if (!svg) return;
		const rect = svg.getBoundingClientRect();
		tooltipX = e.clientX - rect.left;
		tooltipY = e.clientY - rect.top;
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

<div class="relative w-full" bind:clientWidth={containerWidth}>
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
						cx={xScale(dot.value)}
						cy={midY + seededJitter(i, jitterAmp)}
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
