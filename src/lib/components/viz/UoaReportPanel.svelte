<script lang="ts">
	import { FLAG_BADGE, PRELIM_FLAG_BADGE, systemBaseColor } from '$lib/utils/colors';
	import PrelimBadge from '$lib/components/ui/PrelimBadge.svelte';

	type Row = Record<string, any>;

	interface Props {
		uoa: string;
		row: Row;
		systems: { id: string; label: string }[];
		systemCodes: Map<string, string[]>;
		/** Called when user clicks "Drill down" for a given system. */
		ondrilldown?: (uoa: string, systemId: string) => void;
		/** Called when user closes the panel. */
		onclose?: () => void;
	}

	let { uoa, row, systems, systemCodes, ondrilldown, onclose }: Props = $props();

	// ── Per-system stats from the row ─────────────────────────────────────────
	interface SystemStat {
		id: string;
		label: string;
		status: string;
		flag_n: number;
		no_flag_n: number;
		missing_n: number;
		within10: number;
	}

	const systemStats = $derived.by<SystemStat[]>(() => {
		return systems.map((sys) => {
			const codes = systemCodes.get(sys.id) ?? [];
			let within10 = 0;
			for (const c of codes) {
				if (row[`${c}_flag`] !== true && row[`${c}_within_10perc`] === true) within10++;
			}
			return {
				id: sys.id,
				label: sys.label,
				status: String(row[`${sys.id}.status`] ?? 'no_data'),
				flag_n: Number(row[`${sys.id}.flag_n`] ?? 0),
				no_flag_n: Number(row[`${sys.id}.no_flag_n`] ?? 0),
				missing_n: Number(row[`${sys.id}.missing_n`] ?? 0),
				within10
			};
		});
	});

	// ── Aggregate totals ──────────────────────────────────────────────────────
	const totalFlags = $derived(systemStats.reduce((s, ss) => s + ss.flag_n, 0));
	const totalNoFlag = $derived(systemStats.reduce((s, ss) => s + ss.no_flag_n, 0));
	const totalMissing = $derived(systemStats.reduce((s, ss) => s + ss.missing_n, 0));
	const totalWithin10 = $derived(systemStats.reduce((s, ss) => s + ss.within10, 0));

	const STATUS_ORDER: Record<string, number> = {
		flag: 0,
		insufficient_evidence: 1,
		no_flag: 2,
		no_data: 3
	};
</script>

<div class="card bg-base-100 border-base-300/40 border shadow-md">
	<div class="card-body gap-4">
		<!-- Header -->
		<div class="flex items-start justify-between gap-2">
			<div>
				<h3 class="text-lg font-bold">{uoa}</h3>
				<div class="mt-1 flex items-center gap-2">
					<span class="text-base-content/60 text-xs">Preliminary classification:</span>
					{#if PRELIM_FLAG_BADGE[row.prelim_flag]}
						<PrelimBadge value={row.prelim_flag} />
					{:else}
						<span class="text-base-content/40 text-xs">—</span>
					{/if}
				</div>
			</div>
			{#if onclose}
				<button class="btn btn-sm btn-circle" onclick={onclose} aria-label="Close panel">✕</button>
			{/if}
		</div>

		<!-- Aggregate counts -->
		<div class="flex flex-wrap gap-3 text-sm">
			<span class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 rounded-full" style="background-color: var(--color-flag)"></span>
				<strong>{totalFlags}</strong> with flag
			</span>
			<span class="flex items-center gap-1.5">
				<span class="h-2.5 w-2.5 rounded-full" style="background-color: var(--color-no-flag)"
				></span>
				<strong>{totalNoFlag}</strong> no flag
			</span>
			{#if totalWithin10 > 0}
				<span class="flex items-center gap-1.5">
					<span class="badge badge-warning badge-xs"></span>
					<strong>{totalWithin10}</strong> near threshold
				</span>
			{/if}
			{#if totalMissing > 0}
				<span class="flex items-center gap-1.5">
					<span class="h-2.5 w-2.5 rounded-full" style="background-color: var(--color-no-data)"
					></span>
					<strong>{totalMissing}</strong> missing
				</span>
			{/if}
		</div>

		<!-- Per-system breakdown -->
		<div class="divide-base-content/10 divide-y">
			{#each [...systemStats].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)) as ss (ss.id)}
				{@const fb = FLAG_BADGE[ss.status] ?? FLAG_BADGE.no_data}
				{@const sysColor = systemBaseColor(ss.id)}
				<div class="flex items-center gap-3 py-2">
					<!-- System color dot -->
					<span class="h-3 w-3 shrink-0 rounded-full" style="background-color: {sysColor}"></span>

					<!-- Label + counts -->
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="text-sm leading-tight font-medium">{ss.label}</span>
							{#if ss.within10 > 0}
								<span class="badge badge-warning badge-xs">~{ss.within10}</span>
							{/if}
						</div>
						<div class="text-base-content/50 mt-0.5 flex gap-2 text-xs">
							<span>{ss.flag_n} flag</span>
							<span>·</span>
							<span>{ss.no_flag_n} no flag</span>
							{#if ss.missing_n > 0}
								<span>·</span>
								<span>{ss.missing_n} missing</span>
							{/if}
						</div>
					</div>

					<!-- Status badge -->
					<span class="badge badge-sm shrink-0 {fb.badgeCls}">{fb.label}</span>

					<!-- Drilldown link -->
					{#if ondrilldown}
						<button
							class="btn btn-xs shrink-0"
							onclick={() => ondrilldown?.(uoa, ss.id)}
							aria-label="Drill down into {ss.label} for {uoa}">↗</button
						>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>
