<script lang="ts">
	interface Props {
		x: number;
		height: number;
		label?: string;
		color?: string;
	}

	let { x, height, label = 'AN', color = '#f97316' }: Props = $props();
</script>

<g class="threshold-line">
	<line
		x1={x}
		y1={0}
		x2={x}
		y2={height}
		stroke={color}
		stroke-width="1.5"
		stroke-dasharray="4,3"
	/>
	{#if label}
		<text x={x + 3} y={9} font-size="8" fill={color} font-weight="600">{label}</text>
	{/if}
</g>
