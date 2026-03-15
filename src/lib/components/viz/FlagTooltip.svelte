<script lang="ts">
	import { fmt } from './format.js';

	interface Props {
		uoa: string;
		value: number;
		threshold: number | null;
		direction: string | null;
		flagLabel: string;
		within10: boolean | null;
		x: number;
		y: number;
	}

	let { uoa, value, threshold, direction, flagLabel, within10, x, y }: Props = $props();
</script>

<div
	class="pointer-events-none absolute z-50 min-w-40 rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg"
	style="left:{x + 12}px; top:{y - 8}px; transform:translateY(-100%);"
>
	<div class="mb-1 font-semibold text-gray-800">{uoa}</div>

	<div class="text-gray-600">
		Value: <span class="font-mono font-semibold">{fmt(value)}</span>
	</div>

	{#if threshold !== null}
		<div class="text-gray-600">
			AN threshold: <span class="font-mono">{fmt(threshold)}</span>
			{#if direction}<span class="ml-1 text-gray-400">({direction})</span>{/if}
		</div>
	{/if}

	<div class="mt-1 flex flex-wrap gap-1">
		{#if flagLabel === 'flag'}
			<span class="badge badge-error badge-sm">Flagged</span>
			{#if within10}
				<span class="badge badge-warning badge-sm">Within 10 %</span>
			{/if}
		{:else if flagLabel === 'noflag'}
			<span class="badge badge-success badge-sm">OK</span>
			{#if within10}
				<span class="badge badge-warning badge-sm">Within 10 %</span>
			{/if}
		{:else}
			<span class="badge badge-ghost badge-sm">No data</span>
		{/if}
	</div>
</div>
