<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { tidy, arrange, fixedOrder, desc, mutate, summarize, n, sum } from '@tidyjs/tidy';
	import PrelimBadge from '$lib/components/ui/PrelimBadge.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import { PRELIM_FLAG_BADGE } from '$lib/utils/colors';

	type Row = Record<string, unknown>;

	interface Props {
		rows: Row[];
		systems: { id: string; label: string }[];
		systemCodes: Map<string, string[]>;
		/** Called when a row is clicked — filter by the row's prelim key. */
		onprelimclick?: (key: string | null) => void;
	}

	let { rows, systems, systemCodes, onprelimclick }: Props = $props();

	// Prelim flags that count as an acute classification
	const ACUTE_FLAGS = new Set(['EM', 'ROEM', 'ACUTE']);

	interface RankedRow {
		uoa: string;
		prelim_flag: string;
		flaggedSystems: number;
		flaggedIndicators: number;
		within10: number;
	}

	const ranked = $derived(
		tidy(
			rows,
			mutate({
				uoa: (row) => String(row.uoa ?? ''),
				prelim_flag: (row) => String(row.prelim_flag ?? ''),
				flaggedSystems: (row) => {
					let count = 0;
					for (const sys of systems) {
						const codes = systemCodes.get(sys.id) ?? [];
						if (codes.some((c) => row[`${c}_flag`] === true)) count++;
					}
					return count;
				},
				flaggedIndicators: (row) => {
					let count = 0;
					for (const sys of systems)
						for (const c of systemCodes.get(sys.id) ?? []) if (row[`${c}_flag`] === true) count++;
					return count;
				},
				within10: (row) => {
					let count = 0;
					for (const sys of systems)
						for (const c of systemCodes.get(sys.id) ?? [])
							if (row[`${c}_flag`] !== true && row[`${c}_within_10perc`] === true) count++;
					return count;
				}
			})
		) as unknown as RankedRow[]
	);

	// ── Tweened summary ───────────────────────────────────────────────────────
	const summary = $derived(
		tidy(
			ranked,
			summarize({
				total: n(),
				flagged: n({ predicate: (r) => ACUTE_FLAGS.has(r.prelim_flag) }),
				totalFlags: sum('flaggedIndicators'),
				totalWithin10: sum('within10')
			})
		)[0] ?? { total: 0, flagged: 0, totalFlags: 0, totalWithin10: 0 }
	);

	const tweenedSummary = Tween.of(() => summary, { duration: 600, easing: cubicOut });

	// ── Table rows — sorted via tidy: prelim flag order → systems → indicators → near ───────────
	const tableRows = $derived(
		tidy(
			ranked,
			arrange([
				fixedOrder('prelim_flag', Object.keys(PRELIM_FLAG_BADGE)),
				desc('flaggedSystems'),
				desc('flaggedIndicators'),
				desc('within10')
			])
		).map((r) => ({
			UoA: r.uoa,
			Flag: r.prelim_flag,
			Systems: r.flaggedSystems,
			Indicators: r.flaggedIndicators,
			Near: r.within10
		}))
	);

	// Lookup ranked entry by UoA for row click
	const rankedByUoa = $derived(new Map(ranked.map((r) => [r.uoa, r])));

	function handleRowClick(cells: Record<string, string>) {
		const r = rankedByUoa.get(cells['UoA'] ?? '');
		onprelimclick?.(r?.prelim_flag ?? null);
	}
</script>

<div class="card bg-base-100 border-base-300 flex flex-col border shadow-sm">
	<div class="card-body h-full items-stretch justify-start gap-3">
		<h2 class="card-title">UoAs ranked by preliminary flag</h2>

		{#if rows.length === 0}
			<span class="text-base-content/70 py-8 text-center text-sm"
				>No data matches current filters.</span
			>
		{:else}
			<!-- Summary stats -->
			<div class="text-base-content/75 flex flex-wrap gap-x-4 gap-y-1 text-xs">
				<span
					><strong class="text-base-content tabular-nums"
						>{Math.round(tweenedSummary.current.total)}</strong
					> UoA(s)</span
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
			<p class="text-base-content/65 text-xs">
				Systems / Indicators: flagged count · Near: within 10% of threshold. Click a row to filter
				by its classification.
			</p>

			<DataTable
				rows={tableRows}
				tableClass="table-xs"
				overflow="scroll"
				scrollHeight="24rem"
				booleanToStr={false}
				colOptions={{
					UoA: { extraClass: 'text-center' },
					Flag: { extraClass: 'text-center' },
					Systems: { extraClass: 'text-center' },
					Indicators: { extraClass: 'text-center' },
					Near: { extraClass: 'text-center' }
				}}
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
