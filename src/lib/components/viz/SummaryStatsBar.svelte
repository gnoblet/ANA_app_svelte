<script lang="ts">
	import { PRELIM_FLAG_BADGE } from '$lib/utils/colors';
	import LegendBadge from '$lib/components/ui/LegendBadge.svelte';

	type Row = Record<string, any>;

	interface Props {
		rows: Row[];
	}

	let { rows }: Props = $props();

	const PRELIM_KEYS = ['EM', 'ROEM', 'ACUTE', 'NO_ACUTE_NEEDS', 'INSUFFICIENT_EVIDENCE', 'NO_DATA'];
	const FLAGGED_KEYS = new Set(['EM', 'ROEM', 'ACUTE']);

	const prelimCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const k of PRELIM_KEYS) counts[k] = 0;
		for (const row of rows) {
			const k = String(row.prelim_flag ?? '');
			if (k in counts) counts[k]++;
		}
		return counts;
	});

	const flaggedCount = $derived(
		PRELIM_KEYS.filter((k) => FLAGGED_KEYS.has(k)).reduce((s, k) => s + (prelimCounts[k] ?? 0), 0)
	);

	const noAcuteCount = $derived(prelimCounts['NO_ACUTE_NEEDS'] ?? 0);
	const insuffCount = $derived(
		(prelimCounts['INSUFFICIENT_EVIDENCE'] ?? 0) + (prelimCounts['NO_DATA'] ?? 0)
	);
</script>

<div class="card bg-base-100 border-base-300/40 border shadow-sm">
	<div class="card-body py-4">
		<div class="flex flex-wrap items-center gap-x-8 gap-y-3">
			<!-- Total -->
			<div class="flex items-baseline gap-2">
				<span class="text-2xl font-bold">{rows.length}</span>
				<span class="text-base-content/60 text-sm">UOAs</span>
			</div>

			<!-- Separator -->
			<div class="text-base-content/15 text-lg">|</div>

			<!-- Acute needs -->
			<div class="flex items-baseline gap-2">
				<span class="text-2xl font-bold" style="color: var(--color-prelim-an)">{flaggedCount}</span>
				<span class="text-base-content/60 text-sm">with acute needs</span>
			</div>

			<!-- No acute needs -->
			{#if noAcuteCount > 0}
				<div class="flex items-baseline gap-2">
					<span class="text-2xl font-bold" style="color: var(--color-prelim-no-an)"
						>{noAcuteCount}</span
					>
					<span class="text-base-content/60 text-sm">no acute needs</span>
				</div>
			{/if}

			<!-- Insufficient / no data -->
			{#if insuffCount > 0}
				<div class="flex items-baseline gap-2">
					<span class="text-2xl font-bold text-base-content/40">{insuffCount}</span>
					<span class="text-base-content/60 text-sm">insufficient / no data</span>
				</div>
			{/if}

			<!-- Breakdown chips (only categories that have entries) -->
			<div class="ml-auto flex flex-wrap items-center gap-1.5">
				{#each PRELIM_KEYS as key (key)}
					{@const count = prelimCounts[key] ?? 0}
					{@const badge = PRELIM_FLAG_BADGE[key]}
					{#if badge && count > 0}
						<span
							class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold"
							style="background-color: {badge.bg}; color: #fff"
						>{count} {badge.label}</span>
					{/if}
				{/each}
			</div>
		</div>

		<LegendBadge
			prelimKeys={['EM', 'ROEM', 'ACUTE', 'NO_ACUTE_NEEDS', 'INSUFFICIENT_EVIDENCE', 'NO_DATA']}
		/>
	</div>
</div>
