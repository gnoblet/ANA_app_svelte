<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
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
	<h2 class="text-base-content/80 mb-6 text-lg font-semibold uppercase">Systems</h2>

	<div class="mb-6 grid grid-cols-[1fr_2fr] items-start gap-6">
		<!-- Guide text -->
		<div
			class="card bg-base-100 border-base-300 h-full border shadow-sm"
			in:fly={{ y: 16, duration: 500, opacity: 0, easing: cubicOut }}
		>
			<div class="card-body gap-4">
				<h3 class="text-base font-semibold">How to read this section</h3>
				<div class="text-base-content/70 space-y-3 text-sm leading-relaxed">
					<div class="flex items-start gap-3">
						<span
							class="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full font-bold"
							>1</span
						>
						<p>
							<strong class="font-semibold">Coverage bars</strong> — Each bar shows how many UOAs received
							a flag, no flag, insufficient evidence, or had no data for that system.
						</p>
					</div>
					<div class="flex items-start gap-3">
						<span
							class="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full font-bold"
							>2</span
						>
						<p>
							<strong class="font-semibold">System matrix</strong> — The grid below maps every area
							(rows) against every system (columns). Color encodes the system-level flag status.
							Each cell's tooltip gives flag status of that system's subfactors.
							<strong>Click a cell</strong> to drill into that area × system combination.
						</p>
					</div>
					<div class="flex items-start gap-3">
						<span
							class="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full font-bold"
							>3</span
						>
						<p>
							<strong class="font-semibold">Drill-down panel</strong> — After clicking a cell, a
							detail panel appears below with individual indicator values, flag statuses, and
							whether any value is within 10 % of a threshold.
							<strong> Click on radio buttons </strong> to filter for Preference level and Flag status.
						</p>
					</div>
				</div>
			</div>
		</div>

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
