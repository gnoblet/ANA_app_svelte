<script lang="ts">
	import { PRELIM_FLAG_BADGE } from '$lib/utils/colors';
	import PrelimBadge from '$lib/components/ui/PrelimBadge.svelte';
	import SortIcon from '$lib/components/ui/SortIcon.svelte';

	type Row = Record<string, any>;

	interface Props {
		rows: Row[];
		systems: { id: string; label: string }[];
		systemCodes: Map<string, string[]>;
		/** Called when user clicks a row — triggers drilldown for first flagged system. */
		onselect?: (uoa: string, systemId: string) => void;
	}

	let { rows, systems, systemCodes, onselect }: Props = $props();

	// ── Severity score ────────────────────────────────────────────────────────
	// Higher = more severe. EM=5, ROEM=4, ACUTE=3, INSUFFICIENT=2, NO_ACUTE=1, NO_DATA=0
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
		firstFlaggedSystem: string | null;
	}

	const ranked = $derived.by<RankedRow[]>(() => {
		return rows.map((row) => {
			let flaggedSystems = 0;
			let flaggedIndicators = 0;
			let within10 = 0;
			let firstFlaggedSystem: string | null = null;

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
				if (sysHasFlag) {
					flaggedSystems++;
					if (!firstFlaggedSystem) firstFlaggedSystem = sys.id;
				}
			}

			const pf = String(row.prelim_flag ?? '');
			return {
				uoa: String(row.uoa),
				prelim_flag: pf,
				severityScore: PRELIM_SCORE[pf] ?? 0,
				flaggedSystems,
				flaggedIndicators,
				within10,
				firstFlaggedSystem
			};
		});
	});

	// ── Sort ──────────────────────────────────────────────────────────────────
	type SortKey = 'uoa' | 'severity' | 'flaggedSystems' | 'flaggedIndicators' | 'within10';
	let sortKey = $state<SortKey>('severity');
	let sortAsc = $state(false); // default: most severe first

	function toggleSort(key: SortKey) {
		if (sortKey === key) sortAsc = !sortAsc;
		else {
			sortKey = key;
			sortAsc = key === 'uoa';
		}
	}

	const sortedRanked = $derived.by(() => {
		return [...ranked].sort((a, b) => {
			let cmp = 0;
			switch (sortKey) {
				case 'uoa':
					cmp = a.uoa.localeCompare(b.uoa);
					break;
				case 'severity':
					cmp = a.severityScore - b.severityScore;
					break;
				case 'flaggedSystems':
					cmp = a.flaggedSystems - b.flaggedSystems;
					break;
				case 'flaggedIndicators':
					cmp = a.flaggedIndicators - b.flaggedIndicators;
					break;
				case 'within10':
					cmp = a.within10 - b.within10;
					break;
			}
			return sortAsc ? cmp : -cmp;
		});
	});

	function handleRowClick(r: RankedRow) {
		if (!onselect) return;
		// Drill into first flagged system, or first system if none flagged
		const targetSystem = r.firstFlaggedSystem ?? systems[0]?.id;
		if (targetSystem) onselect(r.uoa, targetSystem);
	}
</script>

<div class="card bg-base-100 border-base-300/40 border shadow-sm">
	<div class="card-body">
		<h2 class="card-title">UOA severity ranking</h2>
		<p class="mb-2 text-sm">Sorted by classification severity. Click a row to drill down.</p>

		{#if rows.length === 0}
			<span class="text-base-content/70 py-8 text-center text-sm"
				>No data matches current filters.</span
			>
		{:else}
			<div class="border-base-content/20 max-h-96 overflow-auto rounded border">
				<table class="table-xs table">
					<thead class="sticky top-0 z-10">
						<tr class="bg-base-200">
							<th class="select-none">
								<button
									class="hover:text-base-content/70 flex items-center gap-1 font-semibold"
									onclick={() => toggleSort('uoa')}
									aria-label="Sort by UOA"
								>
									UOA <SortIcon active={sortKey === 'uoa'} asc={sortAsc} />
								</button>
							</th>
							<th class="text-center select-none">
								<button
									class="hover:text-base-content/70 flex items-center justify-center gap-1 font-semibold"
									onclick={() => toggleSort('severity')}
									aria-label="Sort by classification"
								>
									Classification <SortIcon active={sortKey === 'severity'} asc={sortAsc} />
								</button>
							</th>
							<th class="text-center select-none">
								<button
									class="hover:text-base-content/70 flex items-center justify-center gap-1 font-semibold"
									onclick={() => toggleSort('flaggedSystems')}
									aria-label="Sort by flagged systems"
								>
									Systems with flag <SortIcon active={sortKey === 'flaggedSystems'} asc={sortAsc} />
								</button>
							</th>
							<th class="text-center select-none">
								<button
									class="hover:text-base-content/70 flex items-center justify-center gap-1 font-semibold"
									onclick={() => toggleSort('flaggedIndicators')}
									aria-label="Sort by flagged indicators"
								>
									Indicators with flag <SortIcon
										active={sortKey === 'flaggedIndicators'}
										asc={sortAsc}
									/>
								</button>
							</th>
							<th class="text-center select-none">
								<button
									class="hover:text-base-content/70 flex items-center justify-center gap-1 font-semibold"
									onclick={() => toggleSort('within10')}
									aria-label="Sort by near-threshold count"
								>
									Near threshold <SortIcon active={sortKey === 'within10'} asc={sortAsc} />
								</button>
							</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedRanked as r (r.uoa)}
							<tr
								class="hover:bg-base-200/60 cursor-pointer transition-colors"
								onclick={() => handleRowClick(r)}
							>
								<td class="font-medium whitespace-nowrap">{r.uoa}</td>
								<td class="text-center">
									{#if PRELIM_FLAG_BADGE[r.prelim_flag]}
										<PrelimBadge value={r.prelim_flag} />
									{:else}
										<span class="text-base-content/40">–</span>
									{/if}
								</td>
								<td class="text-center">
									<span
										class="font-semibold"
										style={r.flaggedSystems > 0 ? 'color: var(--color-flag)' : ''}
										>{r.flaggedSystems}</span
									>
									<span class="text-base-content/40 text-xs"> / {systems.length}</span>
								</td>
								<td class="text-center">
									<span
										class="font-semibold"
										style={r.flaggedIndicators > 0 ? 'color: var(--color-flag)' : ''}
										>{r.flaggedIndicators}</span
									>
								</td>
								<td class="text-center">
									{#if r.within10 > 0}
										<span class="badge badge-warning badge-sm">~{r.within10}</span>
									{:else}
										<span class="text-base-content/30">–</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
