<script lang="ts">
	import SystemCoverageBars from '$lib/components/viz/SystemCoverageBars.svelte';
	import SystemMatrix from '$lib/components/viz/SystemMatrix.svelte';

	type Row = Record<string, any>;
	type System = { id: string; label: string };

	interface Props {
		filteredFlagged: Row[];
		systems: System[];
		systemCodes: Map<string, string[]>;
		subList: { path: string; codes: string[] }[];
		indicatorsJson: unknown;
		selectedUoa: string | null;
		selectedSystem: string | null;
	}

	let {
		filteredFlagged,
		systems,
		systemCodes,
		subList,
		indicatorsJson,
		selectedUoa = $bindable(null),
		selectedSystem = $bindable(null)
	}: Props = $props();
</script>

<section id="systems" class="scroll-mt-28">
	<h2 class="text-base-content/40 mb-6 text-xs font-semibold tracking-widest uppercase">
		Systems
	</h2>

	<div class="mb-6">
		<SystemCoverageBars rows={filteredFlagged} {systems} />
	</div>

	<div class="card bg-base-100 border-base-300 border shadow-sm">
		<div class="card-body">
			<SystemMatrix
				rows={filteredFlagged}
				{systems}
				{systemCodes}
				{subList}
				{indicatorsJson}
				bind:selectedUoa
				bind:selectedSystem
			/>
		</div>
	</div>
</section>
