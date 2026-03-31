<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';

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

	/** Map raw flag_label values to filter keys. */
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

	// ── Sort ───────────────────────────────────────────────────────────────
	let sortKey = $state<string | null>(null);
	let sortAsc = $state(true);

	function toggleSort(key: string) {
		if (sortKey === key) sortAsc = !sortAsc;
		else {
			sortKey = key;
			sortAsc = true;
		}
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
</script>

<div class="card bg-white shadow">
	<div class="card-body space-y-4">
		<div>
			<div class="card-title">{uoa} — {systemLabel}</div>
			<p class="mt-1">
				All indicators for this UOA and system, grouped by factor.
				<span class="text-error font-medium">Flagged</span> rows are highlighted.
			</p>
			<p>Preference and flag buttons below can be used to filter out the tables.</p>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap items-center gap-6">
			<div class="flex items-center gap-3">
				<span class="text-base-content text-xs font-semibold tracking-wide uppercase"
					>Preference</span
				>
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
			<div class="bg-base-content/20 h-4 w-px"></div>
			<div class="flex items-center gap-3">
				<span class="text-base-content text-xs font-semibold tracking-wide uppercase">Flag</span>
				{#each [{ key: 'flag', label: 'flag', cls: 'checkbox-error' }, { key: 'ok', label: 'ok', cls: 'checkbox-success' }, { key: 'no_data', label: 'no data', cls: 'checkbox-neutral' }] as opt (opt.key)}
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
					<h3 class="mb-2 border-b pb-1 text-base font-semibold">{block.factorLabel}</h3>
					<div class="rounded-box border-base-content/30 overflow-x-auto border bg-white">
						<table class="table-xs table w-full">
							<colgroup>
								<col class="w-64" />
							</colgroup>
							<thead>
								<tr class="bg-base-300 text-base-content">
									<th class="select-none">
										<button
											class="hover:text-base-content/80 flex items-center gap-1 font-semibold"
											onclick={() => toggleSort('label')}
											aria-label="Sort by indicator"
										>
											Indicator
											{#if sortKey === 'label'}<svg
													aria-hidden="true"
													class="size-3 shrink-0"
													viewBox="0 0 12 12"
													fill="currentColor"
													>{#if sortAsc}<path d="M6 2l4 6H2z" />{:else}<path
															d="M6 10L2 4h8z"
														/>{/if}</svg
												>{:else}<svg
													aria-hidden="true"
													class="size-3 shrink-0 opacity-30"
													viewBox="0 0 12 12"
													fill="currentColor"><path d="M6 1l3 4H3zM6 11L3 7h6z" /></svg
												>{/if}
										</button>
									</th>
									<th class="text-center select-none">
										<button
											class="hover:text-base-content/80 flex w-full items-center justify-center gap-1 font-semibold"
											onclick={() => toggleSort('pref')}
											aria-label="Sort by preference"
										>
											Pref.
											{#if sortKey === 'pref'}<svg
													aria-hidden="true"
													class="size-3 shrink-0"
													viewBox="0 0 12 12"
													fill="currentColor"
													>{#if sortAsc}<path d="M6 2l4 6H2z" />{:else}<path
															d="M6 10L2 4h8z"
														/>{/if}</svg
												>{:else}<svg
													aria-hidden="true"
													class="size-3 shrink-0 opacity-30"
													viewBox="0 0 12 12"
													fill="currentColor"><path d="M6 1l3 4H3zM6 11L3 7h6z" /></svg
												>{/if}
										</button>
									</th>
									<th class="text-center select-none">
										<button
											class="hover:text-base-content/80 flex w-full items-center justify-center gap-1 font-semibold"
											onclick={() => toggleSort('value')}
											aria-label="Sort by value"
										>
											Value
											{#if sortKey === 'value'}<svg
													aria-hidden="true"
													class="size-3 shrink-0"
													viewBox="0 0 12 12"
													fill="currentColor"
													>{#if sortAsc}<path d="M6 2l4 6H2z" />{:else}<path
															d="M6 10L2 4h8z"
														/>{/if}</svg
												>{:else}<svg
													aria-hidden="true"
													class="size-3 shrink-0 opacity-30"
													viewBox="0 0 12 12"
													fill="currentColor"><path d="M6 1l3 4H3zM6 11L3 7h6z" /></svg
												>{/if}
										</button>
									</th>
									<th class="text-center leading-tight whitespace-normal select-none">
										<button
											class="hover:text-base-content/80 flex w-full items-center justify-center gap-1 leading-tight font-semibold whitespace-normal"
											onclick={() => toggleSort('threshold')}
											aria-label="Sort by threshold"
										>
											AN<br />threshold
											{#if sortKey === 'threshold'}<svg
													aria-hidden="true"
													class="size-3 shrink-0"
													viewBox="0 0 12 12"
													fill="currentColor"
													>{#if sortAsc}<path d="M6 2l4 6H2z" />{:else}<path
															d="M6 10L2 4h8z"
														/>{/if}</svg
												>{:else}<svg
													aria-hidden="true"
													class="size-3 shrink-0 opacity-30"
													viewBox="0 0 12 12"
													fill="currentColor"><path d="M6 1l3 4H3zM6 11L3 7h6z" /></svg
												>{/if}
										</button>
									</th>
									<th class="text-center select-none">
										<button
											class="hover:text-base-content/80 flex w-full items-center justify-center gap-1 font-semibold"
											onclick={() => toggleSort('direction')}
											aria-label="Sort by direction"
										>
											Direction
											{#if sortKey === 'direction'}<svg
													aria-hidden="true"
													class="size-3 shrink-0"
													viewBox="0 0 12 12"
													fill="currentColor"
													>{#if sortAsc}<path d="M6 2l4 6H2z" />{:else}<path
															d="M6 10L2 4h8z"
														/>{/if}</svg
												>{:else}<svg
													aria-hidden="true"
													class="size-3 shrink-0 opacity-30"
													viewBox="0 0 12 12"
													fill="currentColor"><path d="M6 1l3 4H3zM6 11L3 7h6z" /></svg
												>{/if}
										</button>
									</th>
									<th class="text-center leading-tight whitespace-normal select-none">
										<button
											class="hover:text-base-content/80 flex w-full items-center justify-center gap-1 leading-tight font-semibold whitespace-normal"
											onclick={() => toggleSort('within10')}
											aria-label="Sort by within 10%"
										>
											Within<br />10%
											{#if sortKey === 'within10'}<svg
													aria-hidden="true"
													class="size-3 shrink-0"
													viewBox="0 0 12 12"
													fill="currentColor"
													>{#if sortAsc}<path d="M6 2l4 6H2z" />{:else}<path
															d="M6 10L2 4h8z"
														/>{/if}</svg
												>{:else}<svg
													aria-hidden="true"
													class="size-3 shrink-0 opacity-30"
													viewBox="0 0 12 12"
													fill="currentColor"><path d="M6 1l3 4H3zM6 11L3 7h6z" /></svg
												>{/if}
										</button>
									</th>
									<th class="text-center leading-tight whitespace-normal select-none">
										<button
											class="hover:text-base-content/80 flex w-full items-center justify-center gap-1 leading-tight font-semibold whitespace-normal"
											onclick={() => toggleSort('within10c')}
											aria-label="Sort by within 10% (no flag)"
										>
											Within 10%<br />(no flag)
											{#if sortKey === 'within10c'}<svg
													aria-hidden="true"
													class="size-3 shrink-0"
													viewBox="0 0 12 12"
													fill="currentColor"
													>{#if sortAsc}<path d="M6 2l4 6H2z" />{:else}<path
															d="M6 10L2 4h8z"
														/>{/if}</svg
												>{:else}<svg
													aria-hidden="true"
													class="size-3 shrink-0 opacity-30"
													viewBox="0 0 12 12"
													fill="currentColor"><path d="M6 1l3 4H3zM6 11L3 7h6z" /></svg
												>{/if}
										</button>
									</th>
									<th class="text-center select-none">
										<button
											class="hover:text-base-content/80 flex w-full items-center justify-center gap-1 font-semibold"
											onclick={() => toggleSort('flag')}
											aria-label="Sort by flag"
										>
											Flag
											{#if sortKey === 'flag'}<svg
													aria-hidden="true"
													class="size-3 shrink-0"
													viewBox="0 0 12 12"
													fill="currentColor"
													>{#if sortAsc}<path d="M6 2l4 6H2z" />{:else}<path
															d="M6 10L2 4h8z"
														/>{/if}</svg
												>{:else}<svg
													aria-hidden="true"
													class="size-3 shrink-0 opacity-30"
													viewBox="0 0 12 12"
													fill="currentColor"><path d="M6 1l3 4H3zM6 11L3 7h6z" /></svg
												>{/if}
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
												<span>–</span>
											{:else if within10}
												<span>✓</span>
											{:else}
												<span>✗</span>
											{/if}
										</td>
										<td class="text-center">
											{#if within10change === null || within10change === undefined}
												<span>–</span>
											{:else if within10change}
												<span>✓</span>
											{:else}
												<span>✗</span>
											{/if}
										</td>
										<td class="text-center">
											{#if flagLabel === 'flag'}
												<span class="badge badge-error badge-sm">flag</span>
											{:else if flagLabel === 'noflag'}
												<span class="badge badge-success badge-sm">ok</span>
											{:else}
												<span class="badge badge-ghost badge-sm whitespace-nowrap">no data</span>
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
