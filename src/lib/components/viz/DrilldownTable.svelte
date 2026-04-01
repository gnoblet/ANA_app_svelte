<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import SortIcon from '$lib/components/ui/SortIcon.svelte';

	type Row = Record<string, any>;
	type FactorBlock = { factorKey: string; factorLabel: string; indicatorIds: string[] };
	type IndicatorInfo = {
		label: string;
		threshold_an: any;
		threshold_van: any;
		above_or_below: string | null;
		preference: number | null;
	} | null;

	interface Props {
		uoa: string;
		systemLabel: string;
		row: Row;
		factorBlocks: FactorBlock[];
		indicatorInfo: (id: string) => IndicatorInfo;
		fmt: (v: any) => string;
	}

	let { uoa, systemLabel, row, factorBlocks, indicatorInfo, fmt }: Props = $props();

	// ── Filters ───────────────────────────────────────────────────────────────
	let prefFilter = new SvelteSet<number>();
	let flagFilter = new SvelteSet<string>();

	function togglePref(p: number) {
		if (prefFilter.has(p)) prefFilter.delete(p);
		else prefFilter.add(p);
	}

	function toggleFlag(f: string) {
		if (flagFilter.has(f)) flagFilter.delete(f);
		else flagFilter.add(f);
	}

	function flagKey(label: string | undefined): string {
		if (label === 'flag') return 'flag';
		if (label === 'noflag') return 'ok';
		return 'no_data';
	}

	function isVisible(ind: string): boolean {
		const info = indicatorInfo(ind);
		if (prefFilter.size > 0) {
			const pref = info?.preference ?? null;
			if (pref === null || !prefFilter.has(pref)) return false;
		}
		if (flagFilter.size > 0) {
			const fk = flagKey(row[`${ind}_flag_label`]);
			if (!flagFilter.has(fk)) return false;
		}
		return true;
	}

	// ── Sort ──────────────────────────────────────────────────────────────────
	let sortKey = $state<string | null>(null);
	let sortAsc = $state(true);

	function toggleSort(key: string) {
		if (sortKey === key) sortAsc = !sortAsc;
		else { sortKey = key; sortAsc = true; }
	}

	const FLAG_ORDER: Record<string, number> = { flag: 0, ok: 1, no_data: 2 };

	function sortIndicators(ids: string[]): string[] {
		if (sortKey === null) return ids;
		return [...ids].sort((a, b) => {
			const ia = indicatorInfo(a);
			const ib = indicatorInfo(b);
			let cmp = 0;
			if (sortKey === 'label') {
				cmp = (ia?.label ?? a).localeCompare(ib?.label ?? b);
			} else if (sortKey === 'pref') {
				cmp = (ia?.preference ?? 99) - (ib?.preference ?? 99);
			} else if (sortKey === 'value') {
				const va = typeof row[a] === 'number' ? row[a] : null;
				const vb = typeof row[b] === 'number' ? row[b] : null;
				if (va === null && vb === null) cmp = 0;
				else if (va === null) cmp = 1;
				else if (vb === null) cmp = -1;
				else cmp = va - vb;
			} else if (sortKey === 'threshold') {
				const ta = typeof ia?.threshold_an === 'number' ? ia.threshold_an : null;
				const tb = typeof ib?.threshold_an === 'number' ? ib.threshold_an : null;
				if (ta === null && tb === null) cmp = 0;
				else if (ta === null) cmp = 1;
				else if (tb === null) cmp = -1;
				else cmp = ta - tb;
			} else if (sortKey === 'direction') {
				cmp = (ia?.above_or_below ?? '').localeCompare(ib?.above_or_below ?? '');
			} else if (sortKey === 'within10') {
				const wa = row[`${a}_within_10perc`];
				const wb = row[`${b}_within_10perc`];
				cmp = wa === wb ? 0 : wa ? -1 : 1;
			} else if (sortKey === 'within10c') {
				const wa = row[`${a}_within_10perc_change`];
				const wb = row[`${b}_within_10perc_change`];
				cmp = wa === wb ? 0 : wa ? -1 : 1;
			} else if (sortKey === 'flag') {
				cmp =
					(FLAG_ORDER[flagKey(row[`${a}_flag_label`])] ?? 2) -
					(FLAG_ORDER[flagKey(row[`${b}_flag_label`])] ?? 2);
			}
			return sortAsc ? cmp : -cmp;
		});
	}

	const FLAG_FILTER_OPTIONS = [
		{ key: 'flag',    label: 'Flagged',  cls: 'checkbox-error'   },
		{ key: 'ok',      label: 'OK',       cls: 'checkbox-success' },
		{ key: 'no_data', label: 'No data',  cls: 'checkbox-neutral' }
	] as const;
</script>

<div class="card bg-white shadow">
	<div class="card-body space-y-4">
		<div>
			<h2 class="card-title">{uoa} — {systemLabel}</h2>
			<p class="text-base-content/60 mt-1 text-sm">
				All indicators for this unit of analysis and system, grouped by factor.
				Rows highlighted in red have crossed the acute needs threshold.
			</p>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap items-center gap-6">
			<div class="flex items-center gap-3">
				<span class="text-xs font-semibold uppercase tracking-wide text-base-content">Preference</span>
				{#each [1, 2, 3] as p (p)}
					<label class="flex cursor-pointer items-center gap-1.5">
						<input
							type="checkbox"
							class="checkbox checkbox-xs checkbox-neutral"
							checked={prefFilter.has(p)}
							onchange={() => togglePref(p)}
						/>
						<span class="text-xs">{p}</span>
					</label>
				{/each}
			</div>
			<div class="h-4 w-px bg-base-content/20"></div>
			<div class="flex items-center gap-3">
				<span class="text-xs font-semibold uppercase tracking-wide text-base-content">Status</span>
				{#each FLAG_FILTER_OPTIONS as opt (opt.key)}
					<label class="flex cursor-pointer items-center gap-1.5">
						<input
							type="checkbox"
							class="checkbox checkbox-xs {opt.cls}"
							checked={flagFilter.has(opt.key)}
							onchange={() => toggleFlag(opt.key)}
						/>
						<span class="text-xs">{opt.label}</span>
					</label>
				{/each}
			</div>
		</div>

		{#each factorBlocks as block (block.factorKey)}
			{@const visibleIds = sortIndicators(block.indicatorIds.filter(isVisible))}
			{#if visibleIds.length > 0}
				<div>
					<h3 class="mb-2 border-b border-base-content/10 pb-1 text-sm font-semibold">{block.factorLabel}</h3>
					<div class="overflow-x-auto rounded border border-base-content/20 bg-white">
						<table class="table table-xs w-full">
							<colgroup><col class="w-64" /></colgroup>
							<thead>
								<tr class="bg-base-200 text-base-content">
									<th class="select-none">
										<button class="flex items-center gap-1 font-semibold hover:text-base-content/70" onclick={() => toggleSort('label')} aria-label="Sort by indicator">
											Indicator <SortIcon active={sortKey === 'label'} asc={sortAsc} />
										</button>
									</th>
									<th class="select-none text-center">
										<button class="flex w-full items-center justify-center gap-1 font-semibold hover:text-base-content/70" onclick={() => toggleSort('pref')} aria-label="Sort by preference">
											Pref. <SortIcon active={sortKey === 'pref'} asc={sortAsc} />
										</button>
									</th>
									<th class="select-none text-center">
										<button class="flex w-full items-center justify-center gap-1 font-semibold hover:text-base-content/70" onclick={() => toggleSort('value')} aria-label="Sort by value">
											Value <SortIcon active={sortKey === 'value'} asc={sortAsc} />
										</button>
									</th>
									<th class="select-none whitespace-normal text-center leading-tight">
										<button class="flex w-full items-center justify-center gap-1 whitespace-normal font-semibold leading-tight hover:text-base-content/70" onclick={() => toggleSort('threshold')} aria-label="Sort by threshold">
											AN<br />threshold <SortIcon active={sortKey === 'threshold'} asc={sortAsc} />
										</button>
									</th>
									<th class="select-none text-center">
										<button class="flex w-full items-center justify-center gap-1 font-semibold hover:text-base-content/70" onclick={() => toggleSort('direction')} aria-label="Sort by direction">
											Direction <SortIcon active={sortKey === 'direction'} asc={sortAsc} />
										</button>
									</th>
									<th class="select-none whitespace-normal text-center leading-tight">
										<button class="flex w-full items-center justify-center gap-1 whitespace-normal font-semibold leading-tight hover:text-base-content/70" onclick={() => toggleSort('within10')} aria-label="Sort by within 10%">
											Within<br />10% <SortIcon active={sortKey === 'within10'} asc={sortAsc} />
										</button>
									</th>
									<th class="select-none whitespace-normal text-center leading-tight">
										<button class="flex w-full items-center justify-center gap-1 whitespace-normal font-semibold leading-tight hover:text-base-content/70" onclick={() => toggleSort('within10c')} aria-label="Sort by within 10% (change)">
											Within 10%<br />(no flag) <SortIcon active={sortKey === 'within10c'} asc={sortAsc} />
										</button>
									</th>
									<th class="select-none text-center">
										<button class="flex w-full items-center justify-center gap-1 font-semibold hover:text-base-content/70" onclick={() => toggleSort('flag')} aria-label="Sort by flag status">
											Status <SortIcon active={sortKey === 'flag'} asc={sortAsc} />
										</button>
									</th>
								</tr>
							</thead>
							<tbody>
								{#each visibleIds as ind (ind)}
									{@const info = indicatorInfo(ind)}
									{@const value = row[ind]}
									{@const isFlagged = row[`${ind}_flag`] === true}
									{@const within10 = row[`${ind}_within_10perc`]}
									{@const within10change = row[`${ind}_within_10perc_change`]}
									{@const flagLabel = row[`${ind}_flag_label`]}
									<tr class={isFlagged ? 'bg-(--color-flag-tint)' : ''}>
										<td class="text-left">{info?.label ?? ind}</td>
										<td class="text-center">{info?.preference ?? '–'}</td>
										<td class="text-center">{fmt(value)}</td>
										<td class="text-center">{fmt(info?.threshold_an)}</td>
										<td class="text-center">{info?.above_or_below ?? '–'}</td>
										<td class="text-center">
											{#if within10 === null || within10 === undefined}
												<span aria-label="no data">–</span>
											{:else if within10}
												<span aria-label="yes">✓</span>
											{:else}
												<span aria-label="no">✗</span>
											{/if}
										</td>
										<td class="text-center">
											{#if within10change === null || within10change === undefined}
												<span aria-label="no data">–</span>
											{:else if within10change}
												<span aria-label="yes">✓</span>
											{:else}
												<span aria-label="no">✗</span>
											{/if}
										</td>
										<td class="text-center">
											{#if flagLabel === 'flag'}
												<span class="badge badge-error badge-sm">Flagged</span>
											{:else if flagLabel === 'noflag'}
												<span class="badge badge-success badge-sm">OK</span>
											{:else}
												<span class="badge badge-ghost badge-sm whitespace-nowrap">No data</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		{/each}
	</div>
</div>
