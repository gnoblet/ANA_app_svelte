<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import SortIcon from '$lib/components/ui/SortIcon.svelte';
	import { FLAG_BADGE } from '$lib/utils/colors';
	import Card from '$lib/components/ui/Card.svelte';

	type Row = Record<string, any>;
	type FactorBlock = { factorKey: string; factorLabel: string; metricIds: string[] };
	type MetricInfo = {
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
		metricInfo: (id: string) => MetricInfo;
		fmt: (v: any) => string;
	}

	let { uoa, systemLabel, row, factorBlocks, metricInfo, fmt }: Props = $props();

	// Cache all metricInfo lookups once per factorBlocks/metricInfo change — O(1) in template and sort.
	const cachedMetricInfo = $derived.by(() => {
		const allIds = factorBlocks.flatMap((b) => b.metricIds);
		const cache = new Map<string, MetricInfo>(allIds.map((id) => [id, metricInfo(id)]));
		return (id: string) => cache.get(id) ?? metricInfo(id);
	});

	// ── Filters ───────────────────────────────────────────────────────────────
	let prefFilter = new SvelteSet<number>([1, 2]);
	let flagFilter = new SvelteSet<string>(['flag', 'no_flag']);

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
		if (label === 'no_flag') return 'no_flag';
		return 'no_data';
	}

	function isVisible(ind: string): boolean {
		if (prefFilter.size === 0 || flagFilter.size === 0) return false;
		const info = cachedMetricInfo(ind);
		const pref = info?.preference ?? null;
		if (pref === null || !prefFilter.has(pref)) return false;
		const fk = flagKey(row[`${ind}_status`]);
		if (!flagFilter.has(fk)) return false;
		return true;
	}

	// ── Sort ──────────────────────────────────────────────────────────────────
	let sortKey = $state<string | null>(null);
	let sortAsc = $state(true);

	function toggleSort(key: string) {
		if (sortKey === key) sortAsc = !sortAsc;
		else {
			sortKey = key;
			sortAsc = true;
		}
	}

	const FLAG_ORDER: Record<string, number> = { flag: 0, no_flag: 1, no_data: 2 };

	function sortMetrics(ids: string[]): string[] {
		if (sortKey === null) return ids;
		return [...ids].sort((a, b) => {
			const ia = cachedMetricInfo(a);
			const ib = cachedMetricInfo(b);
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
					(FLAG_ORDER[flagKey(row[`${a}_status`])] ?? 2) -
					(FLAG_ORDER[flagKey(row[`${b}_status`])] ?? 2);
			}
			return sortAsc ? cmp : -cmp;
		});
	}

	const FLAG_FILTER_OPTIONS = [
		{ key: 'flag', label: FLAG_BADGE['flag'].label, cls: FLAG_BADGE['flag'].checkboxCls },
		{ key: 'no_flag', label: FLAG_BADGE['no_flag'].label, cls: FLAG_BADGE['no_flag'].checkboxCls },
		{ key: 'no_data', label: FLAG_BADGE['no_data'].label, cls: FLAG_BADGE['no_data'].checkboxCls }
	];

	const totalVisible = $derived(
		factorBlocks.reduce((sum, b) => sum + b.metricIds.filter(isVisible).length, 0)
	);
</script>

<Card
	title="{uoa} — {systemLabel}"
	subtitle="All metrics for this unit of analysis and system, grouped by factor. Rows highlighted in
			red have crossed the acute needs threshold."
>
	<!-- Filters -->
	<div class="bg-base-200 mt-1 mb-3 flex flex-wrap items-center gap-8 rounded-lg px-4 py-3">
		<div class="flex items-center gap-3">
			<span class="text-base-content/85 text-xs font-semibold tracking-wide uppercase"
				>Preference</span
			>
			{#each [1, 2] as p (p)}
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
		<div class="flex items-center gap-3">
			<span class="text-base-content/85 text-xs font-semibold tracking-wide uppercase">Status</span>
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

	{#if totalVisible === 0}
		<p class="text-base-content/75 py-4 text-center text-sm">
			No metrics match the current filters. Try adjusting your preference or status selection, or
			change the selected UoA or system.
		</p>
	{/if}

	{#each factorBlocks as block (block.factorKey)}
		{@const visibleIds = sortMetrics(block.metricIds.filter(isVisible))}
		{#if visibleIds.length > 0}
			<div>
				<h3 class="border-base-content/20 mt-2 mb-2 border-b pb-1 text-sm font-semibold">
					{block.factorLabel}
				</h3>
				<div class="border-base-content/20 bg-base-100 overflow-x-auto rounded border">
					<table class="table-xs table w-full">
						<colgroup><col class="w-64" /></colgroup>
						<thead>
							<tr class="bg-base-200 text-base-content text-xs">
								<th class="select-none">
									<button
										class="hover:text-base-content/70 flex items-center gap-1 font-semibold"
										onclick={() => toggleSort('label')}
										aria-label="Sort by metric"
									>
										Metric <SortIcon active={sortKey === 'label'} asc={sortAsc} />
									</button>
								</th>
								<th class="text-center select-none">
									<button
										class="hover:text-base-content/70 flex w-full items-center justify-center gap-1 font-semibold"
										onclick={() => toggleSort('pref')}
										aria-label="Sort by preference"
									>
										Pref. <SortIcon active={sortKey === 'pref'} asc={sortAsc} />
									</button>
								</th>
								<th class="text-center select-none">
									<button
										class="hover:text-base-content/70 flex w-full items-center justify-center gap-1 font-semibold"
										onclick={() => toggleSort('value')}
										aria-label="Sort by value"
									>
										Value <SortIcon active={sortKey === 'value'} asc={sortAsc} />
									</button>
								</th>
								<th class="text-center leading-tight whitespace-normal select-none">
									<button
										class="hover:text-base-content/70 flex w-full items-center justify-center gap-1 leading-tight font-semibold whitespace-normal"
										onclick={() => toggleSort('threshold')}
										aria-label="Sort by threshold"
									>
										AN<br />threshold <SortIcon active={sortKey === 'threshold'} asc={sortAsc} />
									</button>
								</th>
								<th class="text-center select-none">
									<button
										class="hover:text-base-content/70 flex w-full items-center justify-center gap-1 font-semibold"
										onclick={() => toggleSort('direction')}
										aria-label="Sort by direction"
									>
										Direction <SortIcon active={sortKey === 'direction'} asc={sortAsc} />
									</button>
								</th>
								<th class="text-center leading-tight whitespace-normal select-none">
									<button
										class="hover:text-base-content/70 flex w-full items-center justify-center gap-1 leading-tight font-semibold whitespace-normal"
										onclick={() => toggleSort('within10')}
										aria-label="Sort by within 10%"
									>
										Within<br />10% <SortIcon active={sortKey === 'within10'} asc={sortAsc} />
									</button>
								</th>
								<th class="text-center leading-tight whitespace-normal select-none">
									<button
										class="hover:text-base-content/70 flex w-full items-center justify-center gap-1 leading-tight font-semibold whitespace-normal"
										onclick={() => toggleSort('within10c')}
										aria-label="Sort by within 10% (change)"
									>
										Within 10%<br />(no flag) <SortIcon
											active={sortKey === 'within10c'}
											asc={sortAsc}
										/>
									</button>
								</th>
								<th class="text-center select-none">
									<button
										class="hover:text-base-content/70 flex w-full items-center justify-center gap-1 font-semibold"
										onclick={() => toggleSort('flag')}
										aria-label="Sort by flag status"
									>
										Status <SortIcon active={sortKey === 'flag'} asc={sortAsc} />
									</button>
								</th>
							</tr>
						</thead>
						<tbody>
							{#each visibleIds as ind (ind)}
								{@const info = cachedMetricInfo(ind)}
								{@const value = row[ind]}
								{@const isFlagged = row[`${ind}_flag`] === true}
								{@const within10 = row[`${ind}_within_10perc`]}
								{@const within10change = row[`${ind}_within_10perc_change`]}
								{@const flagLabel = row[`${ind}_status`]}
								{@const fb = FLAG_BADGE[flagKey(flagLabel)] ?? FLAG_BADGE['no_data']}
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
										<span class="badge badge-sm whitespace-nowrap" style={fb.badgeStyle}>{fb.label}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/each}
</Card>
