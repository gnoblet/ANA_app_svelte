<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { tidy, arrange, fixedOrder, desc, mutate, summarize, n, sum } from '@tidyjs/tidy';
	import PrelimBadge from '$lib/components/ui/PrelimBadge.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import { PRELIM_FLAG_BADGE } from '$lib/utils/colors';
	import Card from '$lib/components/ui/Card.svelte';
	import { uoaLabel } from '$lib/stores/adminFeaturesStore.svelte';

	type Row = Record<string, unknown>;

	interface Props {
		rows: Row[];
		systems: { id: string; label: string }[];
		systemCodes: Map<string, string[]>;
		/** Called when a row is clicked — filter by the row's prelim key. */
		onprelimclick?: (key: string | null) => void;
	}

	let { rows, systems, systemCodes, onprelimclick }: Props = $props();

	// Prelim flags that count as an acute preliminary flag
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
			Metrics: r.flaggedIndicators,
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

<Card title="UoAs ranked by preliminary flag" subtitle="Click a row to filter preliminary flags.">
	{#if rows.length === 0}
		<span class="text-base-content/70 py-8 text-center text-sm"
			>No data matches current filters.</span
		>
	{:else}
		<!-- Summary stats -->
		<div class="flex flex-wrap gap-3">
			<span class="badge badge-soft badge-primary">
				<strong class="tabular-nums">{Math.round(tweenedSummary.current.total)}</strong>
				<span>UoA(s)</span>
			</span>
			<span class="badge badge-soft badge-error">
				<strong class="tabular-nums">{Math.round(tweenedSummary.current.flagged)}</strong>
				<span>EM / ROEM / Acute</span>
			</span>
			<span
				class="badge badge-soft"
				style="background-color: var(--color-flag-tint); color: var(--color-base-content)"
			>
				<strong class="tabular-nums">{Math.round(tweenedSummary.current.totalFlags)}</strong>
				<span> flags</span>
			</span>
			<span class="badge badge-soft badge-warning">
				<strong class="tabular-nums">{Math.round(tweenedSummary.current.totalWithin10)}</strong>
				<span>near threshold</span>
			</span>
		</div>
		<p class="text-base-content/85 mt-1 mb-1 text-sm">
			Within each preliminary flag category, UoAs are ranked by number of systems with flags, number
			of metrics with flags, and then number of metrics near threshold.
		</p>

		<DataTable
			rows={tableRows}
			tableClass="table-xs"
			headerRowClass="bg-base-200 text-base-content text-xs"
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
					<span class={Number(value) > 0 ? 'font-semibold' : 'text-base-content/85'}>
						{value}
					</span>
					<span class="text-base-content/85 text-xs"> / {systems.length}</span>
				{:else if col === 'Indicators'}
					<span class={Number(value) > 0 ? 'font-semibold' : 'text-base-content/65'}>{value}</span>
				{:else if col === 'Near'}
					{#if Number(value) > 0}
						<span class="badge badge-warning badge-sm">~{value}</span>
					{:else}
						<span class="text-base-content/65">–</span>
					{/if}
				{:else}
					{uoaLabel(value)}
				{/if}
			{/snippet}
		</DataTable>
	{/if}
</Card>
