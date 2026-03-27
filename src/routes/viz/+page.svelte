<script lang="ts">
	import { onMount } from 'svelte';
	import FlagView from '$lib/components/FlagView.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { flagStore } from '$lib/stores/flagStore.svelte';
	import { indicatorsStore } from '$lib/stores/indicatorsStore.svelte';
	import { loadIndicatorsIntoStore } from '$lib/stores/indicatorsStore.svelte';
	import { tileCssClass } from '$lib/utils/colors';
	import {
		buildSubfactorList,
		getIndicatorMetadata,
		getFactorMetadata
	} from '$lib/access/access_indicators.js';
	// On page load, load indicators into the store
	onMount(() => {
		loadIndicatorsIntoStore();
	});

	type Row = Record<string, any>;
	type System = { id: string; label: string };
	type FactorBlock = { factorKey: string; factorLabel: string; indicatorIds: string[] };

	const flagged = $derived(flagStore.flaggedResult ?? ([] as Row[]));
	const indicatorsJson = $derived(indicatorsStore.indicatorsJson);
	const uploadedAt = $derived(flagStore.uploadedAt);
	const filename = $derived(flagStore.filename);
	const metadataCols = $derived(flagStore.metadataCols ?? ([] as string[]));
	const hasData = $derived(flagStore.flaggedResult !== null && flagged.length > 0);

	// ── Group-by / value filter state ─────────────────────────────────────────

	/** The metadata column currently used for filtering, or null for no filter. */
	let groupByCol: string | null = $state(null);

	/** Distinct values of the selected groupByCol across all rows. */
	const groupByOptions = $derived<{ value: string; label: string }[]>(
		groupByCol === null
			? []
			: [...new Set(flagged.map((r) => String(r[groupByCol!] ?? '')).filter((v) => v !== ''))]
					.sort()
					.map((v) => ({ value: v, label: v }))
	);

	/**
	 * Track which values the user has explicitly *deselected* for the current column.
	 * Scoped to groupByCol — when the column changes this set becomes stale and is
	 * ignored, so no reset effect is needed.
	 */
	let deselectedGroupValues = $state<{ col: string; values: Set<string> }>({
		col: '',
		values: new Set()
	});

	/**
	 * The effective selection: all options minus whatever the user deselected
	 * for the *current* column. Automatically "resets" to all-selected whenever
	 * groupByCol changes because deselectedGroupValues.col no longer matches.
	 */
	const selectedGroupValues = $derived<string[]>(
		groupByOptions
			.map((o) => o.value)
			.filter(
				(v) => deselectedGroupValues.col !== groupByCol || !deselectedGroupValues.values.has(v)
			)
	);

	function onGroupValuesChange(next: string | string[]) {
		const nextSet = new Set(Array.isArray(next) ? next : [next]);
		deselectedGroupValues = {
			col: groupByCol ?? '',
			values: new Set(groupByOptions.map((o) => o.value).filter((v) => !nextSet.has(v)))
		};
	}

	// ── UOA multi-select filter (updated to depend on group-by) ────────────────

	// Build a map from UOA -> group value for the current `groupByCol`.
	// When `groupByCol` is null, map is empty.
	const uoaToGroupValue = $derived(
		groupByCol === null
			? new Map<string, string>()
			: (() => {
					const m = new Map<string, string>();
					for (const r of flagged) {
						const u = String(r.uoa);
						const gv = String(r[groupByCol!] ?? '');
						m.set(u, gv);
					}
					return m;
				})()
	);

	// Options derived from flagged rows but scoped to the active group-by selection.
	// If a column is selected and some values are filtered out (via selectedGroupValues),
	// only UOAs that remain after that filter will appear in the UOA options.
	const uoaOptions = $derived(
		(() => {
			let rows = flagged;
			if (groupByCol !== null) {
				// Only include rows that match the active group-by selection
				rows = rows.filter((r) => selectedGroupValues.includes(String(r[groupByCol!] ?? '')));
			}
			const map = new Map(
				rows.map((r: Row) => [String(r.uoa), { value: String(r.uoa), label: String(r.uoa) }])
			);
			return Array.from(map.values()).sort((a: any, b: any) => a.label.localeCompare(b.label));
		})()
	);

	// Track explicitly deselected UOAs (user action).
	let _deselectedUoas = $state<Set<string>>(new Set());

	// Clamp and extend deselected UOAs:
	// - Keep only values that exist in the current options (auto-clear stale vals)
	// - Also mark as deselected any UOA that belongs to a group value the user has deselected
	//   for the active groupByCol (so group-value deselections implicitly deselect related UOAs).
	const deselectedUoas = $derived(
		new Set(
			uoaOptions
				.map((o) => o.value)
				.filter((v) => {
					// Explicitly deselected by user
					if (_deselectedUoas.has(v)) return true;
					// If group-by is active and the deselectedGroupValues apply to this column,
					// automatically treat UOAs in those deselected group values as deselected.
					if (groupByCol !== null && deselectedGroupValues.col === groupByCol) {
						const gv = uoaToGroupValue.get(v);
						if (gv !== undefined && deselectedGroupValues.values.has(gv)) return true;
					}
					return false;
				})
		)
	);

	// What Select receives as "selected" = all current options minus deselected.
	const selectedUoas = $derived(
		uoaOptions.map((o) => o.value).filter((v) => !deselectedUoas.has(v))
	);

	function onUoasChange(next: string | string[]) {
		const nextSet = new Set(Array.isArray(next) ? next : [next]);
		_deselectedUoas = new Set(uoaOptions.map((o) => o.value).filter((v) => !nextSet.has(v)));
	}

	/** Rows visible after applying the active filters (group-by + UOA) */
	const filteredFlagged = $derived<Row[]>(
		(() => {
			let rows = flagged;
			// apply metadata column filter
			if (!(groupByCol === null || selectedGroupValues.length === groupByOptions.length)) {
				rows = rows.filter((r) => selectedGroupValues.includes(String(r[groupByCol!] ?? '')));
			}
			// apply UOA filter (if any selection restriction)
			if (typeof uoaOptions !== 'undefined' && uoaOptions.length > 0) {
				if (!(selectedUoas.length === uoaOptions.length)) {
					rows = rows.filter((r) => selectedUoas.includes(String(r.uoa)));
				}
			}
			return rows;
		})()
	);

	const systems = $derived<System[]>(
		Array.isArray(indicatorsJson?.systems)
			? (indicatorsJson.systems as any[]).map((s) => ({ id: s.id, label: s.label ?? s.id }))
			: []
	);

	const subList = $derived<{ path: string; codes: string[] }[]>(
		indicatorsJson ? (buildSubfactorList(indicatorsJson) ?? []) : []
	);

	const systemCodes = $derived<Map<string, string[]>>(
		(() => {
			const tempMap = new Map<string, Set<string>>();
			for (const { path, codes } of subList) {
				const [systemId] = String(path).split('.');
				if (!tempMap.has(systemId)) tempMap.set(systemId, new Set());
				for (const c of codes) tempMap.get(systemId)!.add(c);
			}
			const result = new Map<string, string[]>();
			for (const [k, v] of tempMap.entries()) {
				result.set(k, Array.from(v));
			}
			return result;
		})()
	);

	let selectedUoa: string | null = $state(null);
	let selectedSystem: string | null = $state(null);

	/**
	 * Only keep the drilldown selection when the chosen UOA is still present
	 * in the filtered set — clears automatically when the filter removes it.
	 */
	const activeUoa = $derived(
		selectedUoa !== null && filteredFlagged.some((r) => String(r.uoa) === selectedUoa)
			? selectedUoa
			: null
	);
	const activeSystem = $derived(activeUoa !== null ? selectedSystem : null);

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipAvail = $state(0);
	let tooltipMissing = $state(0);
	let tooltipSystem = $state('');

	function cellStats(row: Row, systemId: string) {
		const codes = systemCodes.get(systemId) ?? [];
		let avail = 0,
			missing = 0,
			flag_n = 0;
		for (const c of codes) {
			const v = row[c];
			if (v === null || v === undefined) missing++;
			else avail++;
			if (row[`${c}_flag`] === true) flag_n++;
		}
		return { avail, missing, flag_n };
	}

	function showTooltip(e: MouseEvent, avail: number, missing: number, sysLabel: string) {
		tooltipAvail = avail;
		tooltipMissing = missing;
		tooltipSystem = sysLabel;
		tooltipX = e.clientX + 12;
		tooltipY = e.clientY + 12;
		tooltipVisible = true;
	}

	function moveTooltip(e: MouseEvent) {
		tooltipX = e.clientX + 12;
		tooltipY = e.clientY + 12;
	}

	function hideTooltip() {
		tooltipVisible = false;
	}

	function selectCell(uoa: string, systemId: string) {
		selectedUoa = uoa;
		selectedSystem = systemId;
	}

	function factorBlocksFor(systemId: string): FactorBlock[] {
		const byFactor = new Map<string, Set<string>>();
		for (const { path, codes } of subList) {
			const parts = String(path).split('.');
			if (parts[0] !== systemId) continue;
			const factorKey = `${parts[0]}.${parts[1]}`;
			if (!byFactor.has(factorKey)) byFactor.set(factorKey, new Set());
			for (const c of codes) byFactor.get(factorKey)!.add(c);
		}
		return Array.from(byFactor.entries()).map(([k, set]) => {
			const [sysId, facId] = k.split('.');
			const md = getFactorMetadata(indicatorsJson, sysId, facId) as any;
			return {
				factorKey: k,
				factorLabel: md?.factor_label ?? facId,
				indicatorIds: Array.from(set)
			};
		});
	}

	function indicatorInfo(id: string) {
		if (!indicatorsJson) return null;
		const md = getIndicatorMetadata(indicatorsJson, id) as any;
		if (!md) return null;
		return {
			label: md.raw?.metric ?? md.raw?.indicator_label ?? id,
			threshold_an: md.raw?.thresholds?.an ?? null,
			threshold_van: md.raw?.thresholds?.van ?? null,
			above_or_below: md.raw?.above_or_below ?? null
		};
	}

	function fmt(v: any): string {
		if (v === null || v === undefined) return '–';
		if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
		return String(v);
	}

	function rowFor(uoa: string): Row | undefined {
		return filteredFlagged.find((r) => String(r.uoa) === uoa);
	}

	function systemLabel(systemId: string): string {
		return systems.find((s) => s.id === systemId)?.label ?? systemId;
	}
</script>

<!-- HTML tooltip (fixed, follows mouse) -->
{#if tooltipVisible}
	<div
		class="pointer-events-none fixed z-50 rounded border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg"
		style="left:{tooltipX}px; top:{tooltipY}px; max-width:220px;"
	>
		<div class="mb-1 font-semibold">{tooltipSystem}</div>
		<div class="text-gray-600">
			<span class="bg-noflag-tint mr-1 inline-block h-3 w-3 rounded"></span>Available:
			<strong>{tooltipAvail}</strong>
		</div>
		<div class="text-gray-600">
			<span class="bg-no-data-tint mr-1 inline-block h-3 w-3 rounded"></span>Missing:
			<strong>{tooltipMissing}</strong>
		</div>
	</div>
{/if}

<div class="bg-base-200 min-h-screen p-6">
	<div class="mx-auto max-w-screen-xl space-y-6">
		<h1 class="text-3xl font-bold">Results</h1>

		<!-- Flagging panel always shown at top -->
		<FlagView />

		{#if hasData}
			{#if filename || uploadedAt}
				<div class="text-sm text-gray-500">
					{#if filename}<span class="font-medium">{filename}</span>{/if}
					{#if uploadedAt}
						<span class="ml-2">— processed at {new Date(uploadedAt).toLocaleString()}</span>
					{/if}
				</div>
			{/if}

			<!-- Group-by / value filter controls -->
			{#if metadataCols.length > 0}
				<div class="card bg-base-100 shadow">
					<div class="card-body pt-4 pb-4">
						<div class="flex flex-wrap items-end gap-4">
							<!-- Filter A: column selector -->
							<div class="relative min-w-44">
								<Select
									label="Filter by column"
									selected={groupByCol ?? ''}
									placeholder="(no filter)"
									options={metadataCols.map((c) => ({ value: c, label: c }))}
									onchange={(v) => (groupByCol = (Array.isArray(v) ? v[0] : v) || null)}
								/>
							</div>

							<!-- Filter B: value multi-select (only when a column is chosen) -->
							{#if groupByCol !== null && groupByOptions.length > 0}
								<div class="relative min-w-56">
									<Select
										label="Filter values"
										options={groupByOptions}
										selected={selectedGroupValues}
										placeholder="Select values…"
										onchange={onGroupValuesChange}
									/>
								</div>
							{/if}

							<!-- Filter C: UOA multi-select -->
							<div class="relative min-w-56">
								<Select
									label="Units of analysis"
									options={uoaOptions}
									selected={selectedUoas}
									placeholder="Select UOAs…"
									onchange={onUoasChange}
								/>
							</div>

							<!-- Active-filter badge -->
							{#if groupByCol !== null}
								<span class="self-end text-sm text-gray-500">
									Showing
									<strong>{filteredFlagged.length}</strong> / {flagged.length} UOAs
								</span>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- Tile chart -->
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">System-level flag counts per UOA</h2>
					<p class="mb-2 text-sm text-gray-500">
						Each cell shows the number of flagged indicators. Hover for details, click to drill
						down.
					</p>

					<div class="overflow-x-auto">
						<table class="table-compact table w-full">
							<thead>
								<tr>
									<th class="bg-base-200">UOA</th>
									{#each systems as sys (sys.id)}
										<th class="bg-base-200 text-center text-xs">{sys.label}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each filteredFlagged as row (row.uoa)}
									<tr>
										<td class="font-medium whitespace-nowrap">{row.uoa}</td>
										{#each systems as sys (sys.id)}
											{@const s = cellStats(row, sys.id)}
											{@const active = activeUoa === String(row.uoa) && activeSystem === sys.id}
											<td class="p-1 text-center">
												<button
													class="w-full rounded px-2 py-2 text-sm font-semibold transition-all {tileCssClass(
														s.flag_n,
														s.avail,
														active
													)}"
													onmouseenter={(e) => showTooltip(e, s.avail, s.missing, sys.label)}
													onmousemove={moveTooltip}
													onmouseleave={hideTooltip}
													onclick={() => {
														hideTooltip();
														selectCell(String(row.uoa), sys.id);
													}}
												>
													{s.avail === 0 ? '–' : s.flag_n}
												</button>
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<div class="mt-2 flex gap-4 text-xs text-gray-500">
						<span class="flex items-center gap-1">
							<span class="bg-noflag-tint inline-block h-3 w-3 rounded"></span> 0 flags
						</span>
						<span class="flex items-center gap-1">
							<span class="bg-flag-tint inline-block h-3 w-3 rounded"></span> ≥1 flag
						</span>
						<span class="flex items-center gap-1">
							<span class="bg-no-data-tint inline-block h-3 w-3 rounded"></span> no data
						</span>
					</div>
				</div>
			</div>

			<!-- Drilldown -->
			{#if activeUoa && activeSystem}
				{@const drillRow = rowFor(activeUoa)}
				<div class="card bg-base-100 shadow">
					<div class="card-body space-y-6">
						<div>
							<h2 class="card-title">
								{activeUoa} — {systemLabel(activeSystem)}
							</h2>
							<p class="mt-1 text-sm text-gray-500">
								All indicators for this UOA and system, grouped by factor.
								<span class="font-medium text-red-600">Flagged</span> rows are highlighted.
							</p>
						</div>

						{#each factorBlocksFor(activeSystem) as block (block.factorKey)}
							{#if drillRow}
								<div>
									<h3 class="mb-2 border-b pb-1 text-base font-semibold">{block.factorLabel}</h3>
									<div class="overflow-x-auto">
										<table class="table-compact table w-full text-sm">
											<thead>
												<tr>
													<th>Indicator</th>
													<th class="text-right">Value</th>
													<th class="text-right">AN threshold</th>
													<th class="text-right">Direction</th>
													<th class="text-center">Within 10%</th>
													<th class="text-center">Within 10% (no flag)</th>
													<th class="text-center">Flag</th>
												</tr>
											</thead>
											<tbody>
												{#each block.indicatorIds as ind (ind)}
													{@const info = indicatorInfo(ind)}
													{@const value = drillRow[ind]}
													{@const isFlagged = drillRow[`${ind}_flag`] === true}
													{@const within10 = drillRow[`${ind}_within_10perc`]}
													{@const within10change = drillRow[`${ind}_within_10perc_change`]}
													{@const flagLabel = drillRow[`${ind}_flag_label`]}
													<tr class={isFlagged ? 'bg-red-50' : ''}>
														<td class="font-medium">{info?.label ?? ind}</td>
														<td class="text-right font-mono">{fmt(value)}</td>
														<td class="text-right font-mono">{fmt(info?.threshold_an)}</td>
														<td class="text-right text-gray-500">{info?.above_or_below ?? '–'}</td>
														<td class="text-center">
															{#if within10 === null || within10 === undefined}
																<span class="text-gray-400">–</span>
															{:else if within10}
																<span class="font-semibold text-amber-600">✓</span>
															{:else}
																<span class="text-gray-400">✗</span>
															{/if}
														</td>
														<td class="text-center">
															{#if within10change === null || within10change === undefined}
																<span class="text-gray-400">–</span>
															{:else if within10change}
																<span class="font-semibold text-amber-600">✓</span>
															{:else}
																<span class="text-gray-400">✗</span>
															{/if}
														</td>
														<td class="text-center">
															{#if flagLabel === 'flag'}
																<span class="badge badge-error badge-sm">flag</span>
															{:else if flagLabel === 'noflag'}
																<span class="badge badge-success badge-sm">ok</span>
															{:else}
																<span class="badge badge-ghost badge-sm">no data</span>
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
			{/if}
		{/if}
	</div>
</div>
