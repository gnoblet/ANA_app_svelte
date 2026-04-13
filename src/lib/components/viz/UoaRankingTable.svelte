<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import PrelimBadge from '$lib/components/ui/PrelimBadge.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';

	type Row = Record<string, unknown>;

	interface Props {
		rows: Row[];
		systems: { id: string; label: string }[];
		systemCodes: Map<string, string[]>;
		/** Called when a row is clicked — filter by the row's prelim key. */
		onprelimclick?: (key: string | null) => void;
	}

	let { rows, systems, systemCodes, onprelimclick }: Props = $props();

	const PRELIM_SCORE: Record<string, number> = {
		EM: 5,
		ROEM: 4,
		ACUTE: 3,
		INSUFFICIENT_EVIDENCE: 2,
		NO_ACUTE_NEEDS: 1,
		NO_DATA: 0
	};

	interface RankedRow {
		uoa: string;
		prelim_flag: string;
		severityScore: number;
		flaggedSystems: number;
		flaggedIndicators: number;
		within10: number;
	}

	const ranked = $derived.by<RankedRow[]>(() => {
		return rows.map((row) => {
			let flaggedSystems = 0;
			let flaggedIndicators = 0;
			let within10 = 0;

			for (const sys of systems) {
				const codes = systemCodes.get(sys.id) ?? [];
				let sysHasFlag = false;
				for (const c of codes) {
					if (row[`${c}_flag`] === true) {
						flaggedIndicators++;
						sysHasFlag = true;
					} else if (row[`${c}_within_10perc`] === true) {
						within10++;
					}
				}
				if (sysHasFlag) flaggedSystems++;
			}

			const pf = String(row.prelim_flag ?? '');
			return {
				uoa: String(row.uoa),
				prelim_flag: pf,
				severityScore: PRELIM_SCORE[pf] ?? 0,
				flaggedSystems,
				flaggedIndicators,
				within10
			};
		});
	});

	// ── Tweened summary ───────────────────────────────────────────────────────
	const summary = $derived({
		total: ranked.length,
		flagged: ranked.filter((r) => r.severityScore >= 3).length,
		totalFlags: ranked.reduce((s, r) => s + r.flaggedIndicators, 0),
		totalWithin10: ranked.reduce((s, r) => s + r.within10, 0)
	});

	const tweenedSummary = Tween.of(() => summary, { duration: 600, easing: cubicOut });

	// ── Table rows — pre-sorted by severity desc (DataTable preserves order when sortCol=null) ───
	const tableRows = $derived(
		[...ranked]
			.sort(
				(a, b) => b.severityScore - a.severityScore || b.flaggedIndicators - a.flaggedIndicators
			)
			.map((r) => ({
				UOA: r.uoa,
				Flag: r.prelim_flag,
				Systems: r.flaggedSystems,
				Indicators: r.flaggedIndicators,
				Near: r.within10
			}))
	);

	// Lookup ranked entry by UOA for row click
	const rankedByUoa = $derived(new Map(ranked.map((r) => [r.uoa, r])));

	function handleRowClick(cells: Record<string, string>) {
		const r = rankedByUoa.get(cells['UOA'] ?? '');
		onprelimclick?.(r?.prelim_flag ?? null);
	}
</script>

<div class="card bg-base-100 border-base-300 h-full border shadow-sm">
	<div class="card-body flex flex-col items-stretch justify-start gap-3">
		<h2 class="card-title">UOAs ranked by preliminary flag</h2>

		{#if rows.length === 0}
			<span class="text-base-content/70 py-8 text-center text-sm"
				>No data matches current filters.</span
			>
		{:else}
			<!-- Summary stats -->
			<div class="text-base-content/55 flex flex-wrap gap-x-4 gap-y-1 text-xs">
				<span
					><strong class="text-base-content tabular-nums"
						>{Math.round(tweenedSummary.current.total)}</strong
					> areas</span
				>
				<span
					><strong class="text-base-content tabular-nums"
						>{Math.round(tweenedSummary.current.flagged)}</strong
					> classified EM / ROEM / Acute</span
				>
				<span
					><strong class="text-base-content tabular-nums"
						>{Math.round(tweenedSummary.current.totalFlags)}</strong
					> indicators flagged</span
				>
				{#if summary.totalWithin10 > 0}
					<span
						><strong class="text-base-content tabular-nums"
							>{Math.round(tweenedSummary.current.totalWithin10)}</strong
						> near threshold</span
					>
				{/if}
			</div>
			<p class="text-base-content/45 text-xs">
				Systems / Indicators: flagged count · Near: within 10% of threshold. Click a row to filter
				by its classification.
			</p>

			<DataTable
				rows={tableRows}
				tableClass="table-xs"
				overflow="scroll"
				scrollHeight="24rem"
				booleanToStr={false}
				onrowclick={handleRowClick}
			>
				{#snippet renderCell({ col, value })}
					{#if col === 'Flag'}
						<PrelimBadge {value} />
					{:else if col === 'Systems'}
						<span class={Number(value) > 0 ? 'font-semibold' : 'text-base-content/40'}>
							{value}
						</span>
						<span class="text-base-content/40 text-xs"> / {systems.length}</span>
					{:else if col === 'Indicators'}
						<span class={Number(value) > 0 ? 'font-semibold' : 'text-base-content/40'}>{value}</span
						>
					{:else if col === 'Near'}
						{#if Number(value) > 0}
							<span class="badge badge-warning badge-sm">~{value}</span>
						{:else}
							<span class="text-base-content/30">–</span>
						{/if}
					{:else}
						{value}
					{/if}
				{/snippet}
			</DataTable>
		{/if}
	</div>
</div>
