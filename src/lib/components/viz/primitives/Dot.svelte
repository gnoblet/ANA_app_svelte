<script lang="ts">
	import { dotFill, dotStroke } from '$lib/utils/colors';

	interface Props {
		cx: number;
		cy: number;
		r?: number;
		flagLabel: string;
		within10?: boolean | null;
		onmouseenter?: (e: MouseEvent) => void;
		onmousemove?: (e: MouseEvent) => void;
		onmouseleave?: (e: MouseEvent) => void;
	}

	let {
		cx,
		cy,
		r = 5,
		flagLabel,
		within10 = null,
		onmouseenter,
		onmousemove,
		onmouseleave
	}: Props = $props();
</script>

<circle
	{cx}
	{cy}
	{r}
	fill={dotFill(flagLabel)}
	stroke={dotStroke(flagLabel, within10)}
	stroke-width="1.5"
	style="cursor:pointer;"
	role="img"
	aria-label="data point"
	{onmouseenter}
	{onmousemove}
	{onmouseleave}
/>
