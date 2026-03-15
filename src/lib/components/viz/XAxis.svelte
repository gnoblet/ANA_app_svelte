<script lang="ts">
	import { fmt } from './format.js';

	interface Props {
		scale: (v: number) => number;
		innerWidth: number;
		innerHeight: number;
		numberOfTicks?: number;
		tickValues?: number[];
	}

	let {
		scale,
		innerWidth,
		innerHeight,
		numberOfTicks = 5,
		tickValues = []
	}: Props = $props();

	// Use provided tickValues or derive from scale
	const ticks = $derived(
		tickValues.length > 0
			? tickValues
			: (scale as unknown as { ticks: (n: number) => number[] }).ticks(numberOfTicks)
	);
</script>

<!-- Baseline -->
<line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#e5e7eb" stroke-width="1" />

<!-- Ticks + labels -->
{#each ticks as tick (tick)}
	<g transform="translate({scale(tick)},{innerHeight})">
		<line y2="4" stroke="#9ca3af" stroke-width="1" />
		<text y="14" text-anchor="middle" font-size="9" fill="#6b7280">{fmt(tick)}</text>
	</g>
{/each}
