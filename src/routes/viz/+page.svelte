<script lang="ts">
	import { onMount } from 'svelte';
	import FlagView from '$lib/components/FlagView.svelte';
	import { flagStore } from '$lib/stores/flagStore.js';
	import { indicatorsStore } from '$lib/stores/indicatorsStore.js';
	import { loadIndicatorsIntoStore } from '$lib/stores/indicatorsStore.js';
	import {
		buildSubfactorList,
		getIndicatorMetadata,
		getFactorMetadata
	} from '$lib/access/access_indicators.js';
	onMount(() => {
		loadIndicatorsIntoStore();
	});

	type Row = Record<string, any>;
	type System = { id: string; label: string };
	type FactorBlock = { factorKey: string; factorLabel: string; codes: string[] };

	const flagged = $derived($flagStore.flaggedResult ?? ([] as Row[]));
	const indicatorsJson = $derived($indicatorsStore.indicatorsJson);
	const uploadedAt = $derived($flagStore.uploadedAt);
	const filename = $derived($flagStore.filename);
	const hasData = $derived($flagStore.flaggedResult !== null && flagged.length > 0);

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

	function tileColor(flag_n: number, avail: number, active: boolean) {
		const ring = active ? ' ring-2 ring-primary ring-offset-1' : '';
		if (avail === 0) return `bg-gray-200 text-gray-400${ring}`;
		if (flag_n === 0) return `bg-green-100 text-green-800 hover:bg-green-200${ring}`;
		return `bg-red-100 text-red-800 hover:bg-red-200${ring}`;
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
				codes: Array.from(set)
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
		return flagged.find((r) => r.uoa === uoa);
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
			<span class="mr-1 inline-block h-3 w-3 rounded bg-green-100"></span>Available:
			<strong>{tooltipAvail}</strong>
		</div>
		<div class="text-gray-600">
			<span class="mr-1 inline-block h-3 w-3 rounded bg-gray-200"></span>Missing:
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
								{#each flagged as row (row.uoa)}
									<tr>
										<td class="font-medium whitespace-nowrap">{row.uoa}</td>
										{#each systems as sys (sys.id)}
											{@const s = cellStats(row, sys.id)}
											{@const active = selectedUoa === String(row.uoa) && selectedSystem === sys.id}
											<td class="p-1 text-center">
												<button
													class="w-full rounded px-2 py-2 text-sm font-semibold transition-all {tileColor(
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
							<span class="inline-block h-3 w-3 rounded bg-green-100"></span> 0 flags
						</span>
						<span class="flex items-center gap-1">
							<span class="inline-block h-3 w-3 rounded bg-red-100"></span> ≥1 flag
						</span>
						<span class="flex items-center gap-1">
							<span class="inline-block h-3 w-3 rounded bg-gray-200"></span> no data
						</span>
					</div>
				</div>
			</div>

			<!-- Drilldown -->
			{#if selectedUoa && selectedSystem}
				{@const drillRow = rowFor(selectedUoa)}
				<div class="card bg-base-100 shadow">
					<div class="card-body space-y-6">
						<div>
							<h2 class="card-title">
								{selectedUoa} — {systemLabel(selectedSystem)}
							</h2>
							<p class="mt-1 text-sm text-gray-500">
								All indicators for this UOA and system, grouped by factor.
								<span class="font-medium text-red-600">Flagged</span> rows are highlighted.
							</p>
						</div>

						{#each factorBlocksFor(selectedSystem) as block (block.factorKey)}
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
												{#each block.codes as ind (ind)}
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
