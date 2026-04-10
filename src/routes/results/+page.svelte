<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { asset } from '$app/paths';
	import { flagStore } from '$lib/stores/flagStore.svelte';
	import { indicatorsStore, loadIndicatorsIntoStore } from '$lib/stores/indicatorsStore.svelte';
	import { circlePackingStore, loadCirclePackingData } from '$lib/stores/circlePackingStore.svelte';
	import {
		adminFeaturesStore,
		setAdminFeatures,
		setAdminFetchState
	} from '$lib/stores/adminFeaturesStore.svelte';
	import exploreNav from '$lib/stores/exploreNav.svelte';

	import DataGuard from '$lib/components/ui/DataGuard.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import ButtonClear from '$lib/components/ui/ButtonClear.svelte';
	import RadioToggle from '$lib/components/ui/RadioToggle.svelte';
	import LegendBadge from '$lib/components/ui/LegendBadge.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';

	import PrelimFlagDonut from '$lib/components/viz/PrelimFlagDonut.svelte';
	import UoaRankingTable from '$lib/components/viz/UoaRankingTable.svelte';
	import ChoroplethMap from '$lib/components/viz/ChoroplethMap.svelte';
	import UoaDetailPanel from '$lib/components/viz/UoaDetailPanel.svelte';
	import SystemCoverageBars from '$lib/components/viz/SystemCoverageBars.svelte';
	import SystemMatrix from '$lib/components/viz/SystemMatrix.svelte';
	import IndicatorStrip from '$lib/components/viz/IndicatorStrip.svelte';
	import CirclePacking from '$lib/components/viz/CirclePacking.svelte';

	import { analyzeUoas } from '$lib/utils/pcode';
	import { fetchAdminsForCountry } from '$lib/engine/fetchAdmin';
	import {
		buildSubfactorList,
		getSystemMetadata,
		getFactorMetadata,
		getIndicatorMetadata,
		buildIndicatorRows
	} from '$lib/engine/indicatorMetadata';
	import {
		downloadJSON,
		downloadCSV,
		downloadXLSX,
		downloadDeepDiveZip
	} from '$lib/engine/download';
	import { tidy, filter, distinct, arrange, asc, map } from '@tidyjs/tidy';

	// ── Types ─────────────────────────────────────────────────────────────────

	type Row = Record<string, any>;
	type System = { id: string; label: string };
	type AnyMd = Record<string, unknown> & { raw?: Record<string, unknown> };

	interface DotData {
		uoa: string;
		value: number;
		flagLabel: string;
		within10: boolean | null;
	}
	interface IndicatorBlock {
		id: string;
		label: string;
		metric: string | null;
		threshold: number | null;
		direction: string | null;
		dots: DotData[];
	}
	interface FactorBlock {
		factorId: string;
		factorLabel: string;
		indicators: IndicatorBlock[];
	}
	interface SystemBlock {
		systemId: string;
		systemLabel: string;
		factors: FactorBlock[];
	}

	// ── Core store derivations ────────────────────────────────────────────────

	const flagged = $derived(flagStore.flaggedResult ?? ([] as Row[]));
	const indicatorsJson = $derived(indicatorsStore.indicatorsJson);
	const metadataCols = $derived(flagStore.metadataCols ?? ([] as string[]));
	const hasData = $derived(flagStore.flaggedResult !== null && flagged.length > 0);

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
			for (const [k, v] of tempMap.entries()) result.set(k, Array.from(v));
			return result;
		})()
	);

	// ── P-code / choropleth map ────────────────────────────────────────────────

	const uoaAnalysis = $derived(
		flagged.length > 0 ? analyzeUoas(flagged.map((r) => String(r.uoa))) : null
	);
	const hasPcodes = $derived(uoaAnalysis?.action === 'adm1' || uoaAnalysis?.action === 'adm2');
	const pcodeLevel = $derived<'ADM1' | 'ADM2'>(uoaAnalysis?.action === 'adm2' ? 'ADM2' : 'ADM1');

	const pcodeKey = $derived.by(() => {
		if (!uoaAnalysis || !hasPcodes) return null;
		const first = (uoaAnalysis.parsed ?? []).find(
			(p: { parsed?: { isPcode?: boolean; code?: string } }) => p.parsed?.isPcode
		);
		const code = first?.parsed?.code ?? uoaAnalysis.pcode ?? null;
		return code ? `${code}_${pcodeLevel}` : null;
	});

	$effect(() => {
		if (!pcodeKey || !hasPcodes) return;
		if (
			adminFeaturesStore.fetchState === 'loading' ||
			adminFeaturesStore.fetchState === 'error' ||
			adminFeaturesStore.cachedKey === pcodeKey
		)
			return;
		const first = (uoaAnalysis!.parsed ?? []).find(
			(p: { parsed?: { isPcode?: boolean; code?: string } }) => p.parsed?.isPcode
		);
		const pcode = first?.parsed?.code ?? uoaAnalysis!.pcode ?? '';
		setAdminFetchState('loading');
		fetchAdminsForCountry(pcode as string, pcodeLevel)
			.then((res) => {
				setAdminFeatures(res?.adm1 ?? null, res?.adm2 ?? null, pcodeKey!);
			})
			.catch((e) => {
				setAdminFetchState('error', String(e));
			});
	});

	// ── Section 1: Overview filter state ──────────────────────────────────────

	let groupByCol = $state<string | null>(null);

	const groupByOptions = $derived<{ value: string; label: string }[]>(
		groupByCol === null
			? []
			: tidy(
					flagged,
					filter((r) => r[groupByCol!] != null && String(r[groupByCol!]) !== ''),
					distinct([groupByCol!]),
					arrange(asc(groupByCol!)),
					map((r) => ({ value: String(r[groupByCol!]), label: String(r[groupByCol!]) }))
				)
	);

	let deselectedGroupValues = $state<{ col: string; values: Set<string> }>({
		col: '',
		values: new Set()
	});

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

	const overviewUoaOptions = $derived(
		tidy(
			groupByCol !== null
				? flagged.filter((r) => selectedGroupValues.includes(String(r[groupByCol!] ?? '')))
				: flagged,
			distinct(['uoa']),
			arrange(asc('uoa')),
			map((r: Row) => ({ value: String(r.uoa), label: String(r.uoa) }))
		)
	);

	let overviewSelectedUoas = $state<string[] | null>(null);

	function onOverviewUoasChange(next: string | string[]) {
		const arr = Array.isArray(next) ? next : [next];
		overviewSelectedUoas = arr.length === overviewUoaOptions.length ? null : arr;
	}

	let selectedPrelimKeys = $state<string[] | null>(null);
	const PRELIM_KEYS = ['EM', 'ROEM', 'ACUTE', 'NO_ACUTE_NEEDS', 'INSUFFICIENT_EVIDENCE', 'NO_DATA'];
	const prelimOptions = $derived(
		PRELIM_KEYS.map((k) => ({
			value: k,
			label:
				k === 'NO_ACUTE_NEEDS'
					? 'No Acute Needs'
					: k === 'INSUFFICIENT_EVIDENCE'
						? 'Insufficient Evidence'
						: k === 'NO_DATA'
							? 'No Data'
							: k
		}))
	);

	function onPrelimKeysChange(next: string | string[]) {
		const arr = Array.isArray(next) ? next : [next];
		selectedPrelimKeys = arr.length === PRELIM_KEYS.length ? null : arr;
	}

	function handleDonutSliceClick(key: string | null) {
		if (key === null) {
			selectedPrelimKeys = null;
		} else {
			selectedPrelimKeys =
				selectedPrelimKeys?.includes(key) && selectedPrelimKeys.length === 1 ? null : [key];
		}
	}

	const filteredFlagged = $derived.by<Row[]>(() => {
		let rows = flagged;
		if (groupByCol !== null && selectedGroupValues.length < groupByOptions.length) {
			rows = rows.filter((r) => selectedGroupValues.includes(String(r[groupByCol!] ?? '')));
		}
		if (overviewSelectedUoas !== null) {
			rows = rows.filter((r) => overviewSelectedUoas!.includes(String(r.uoa)));
		}
		if (selectedPrelimKeys !== null) {
			rows = rows.filter((r) => selectedPrelimKeys!.includes(String(r.prelim_flag ?? '')));
		}
		return rows;
	});

	const isFiltered = $derived(
		overviewSelectedUoas !== null || selectedPrelimKeys !== null || groupByCol !== null
	);

	// ── Section 2: Systems — map click + heatmap selection ────────────────────

	let selectedMapUoa = $state<string | null>(null);

	const selectedMapRow = $derived(
		selectedMapUoa !== null
			? (filteredFlagged.find((r) => String(r.uoa) === selectedMapUoa) ?? null)
			: null
	);

	let heatmapSelectedUoa = $state<string | null>(null);
	let heatmapSelectedSystem = $state<string | null>(null);

	function selectInHeatmap(uoa: string, systemId: string) {
		heatmapSelectedUoa = uoa;
		heatmapSelectedSystem = systemId;
		document.getElementById('systems')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	// ── Section 3: Indicators ─────────────────────────────────────────────────

	function buildSystemBlocks(rows: Row[], json: Record<string, unknown>): SystemBlock[] {
		const sl = buildSubfactorList(json) ?? [];
		const blocks: SystemBlock[] = [];
		const systemIds: string[] = [];
		for (const { path } of sl) {
			const sysId = String(path).split('.')[0];
			if (!systemIds.includes(sysId)) systemIds.push(sysId);
		}
		for (const systemId of systemIds) {
			const sysMd = getSystemMetadata(json, systemId) as AnyMd | null;
			const systemLabel: string =
				(sysMd?.system_label as string) ?? (sysMd?.raw?.label as string) ?? systemId;
			const factorIds: string[] = [];
			for (const { path } of sl) {
				const parts = String(path).split('.');
				if (parts[0] !== systemId) continue;
				if (!factorIds.includes(parts[1])) factorIds.push(parts[1]);
			}
			const factorBlocks: FactorBlock[] = [];
			for (const factorId of factorIds) {
				const facMd = getFactorMetadata(json, systemId, factorId) as AnyMd | null;
				const factorLabel: string =
					(facMd?.factor_label as string) ?? (facMd?.raw?.label as string) ?? factorId;
				const indicatorIds: string[] = [];
				for (const { path, codes } of sl) {
					const parts = String(path).split('.');
					if (parts[0] !== systemId || parts[1] !== factorId) continue;
					for (const c of codes) if (!indicatorIds.includes(c)) indicatorIds.push(c);
				}
				const indicatorBlocks: IndicatorBlock[] = [];
				for (const indId of indicatorIds) {
					const dots = rows
						.map((row: Row) => {
							const value = row[indId];
							const flagLabel: string = String(row[`${indId}_status`] ?? 'no_data');
							const w10 = row[`${indId}_within_10perc`];
							const within10: boolean | null = typeof w10 === 'boolean' ? w10 : null;
							return {
								uoa: String(row.uoa),
								value: typeof value === 'number' ? value : NaN,
								flagLabel,
								within10
							};
						})
						.filter((d) => d.flagLabel !== 'no_data' && !isNaN(d.value));
					if (dots.length === 0) continue;
					const indMd = getIndicatorMetadata(json, indId) as AnyMd | null;
					const raw = indMd?.raw as Record<string, unknown> | undefined;
					const label: string =
						(raw?.indicator_label as string) ?? (indMd?.indicator_label as string) ?? indId;
					const metric: string | null = (raw?.metric as string) ?? null;
					const thresholds = raw?.thresholds as Record<string, unknown> | undefined;
					const threshold: number | null =
						typeof thresholds?.an === 'number' ? thresholds.an : null;
					const direction: string | null = (raw?.above_or_below as string) ?? null;
					indicatorBlocks.push({ id: indId, label, metric, threshold, direction, dots });
				}
				if (indicatorBlocks.length === 0) continue;
				factorBlocks.push({ factorId, factorLabel, indicators: indicatorBlocks });
			}
			if (factorBlocks.length === 0) continue;
			blocks.push({ systemId, systemLabel, factors: factorBlocks });
		}
		return blocks;
	}

	const allBlocks = $derived(
		hasData && indicatorsJson
			? buildSystemBlocks(flagged, indicatorsJson as Record<string, unknown>)
			: ([] as SystemBlock[])
	);

	const indSystemOptions = $derived(
		allBlocks.map((s) => ({ value: s.systemId, label: s.systemLabel }))
	);
	const indFactorOptions = $derived(
		allBlocks.flatMap((s) => s.factors.map((f) => ({ value: f.factorId, label: f.factorLabel })))
	);
	const indUoaOptions = $derived(
		tidy(
			flagged,
			distinct(['uoa']),
			arrange(asc('uoa')),
			map((r: Row) => ({ value: String(r.uoa), label: String(r.uoa) }))
		)
	);

	let indSelectedSystems = $state<string[] | null>(null);
	let indSelectedFactors = $state<string[] | null>(null);
	let indSelectedUoas = $state<string[] | null>(null);

	function onIndSystemsChange(next: string | string[]) {
		const arr = Array.isArray(next) ? next : [next];
		indSelectedSystems = arr.length === indSystemOptions.length ? null : arr;
	}
	function onIndFactorsChange(next: string | string[]) {
		const arr = Array.isArray(next) ? next : [next];
		indSelectedFactors = arr.length === indFactorOptions.length ? null : arr;
	}
	function onIndUoasChange(next: string | string[]) {
		const arr = Array.isArray(next) ? next : [next];
		indSelectedUoas = arr.length === indUoaOptions.length ? null : arr;
	}

	const filteredBlocks = $derived(
		allBlocks
			.filter((s) => indSelectedSystems === null || indSelectedSystems.includes(s.systemId))
			.map((s) => ({
				...s,
				factors: s.factors
					.filter((f) => indSelectedFactors === null || indSelectedFactors.includes(f.factorId))
					.map((f) => ({
						...f,
						indicators: f.indicators
							.map((ind) => ({
								...ind,
								dots: ind.dots.filter(
									(d) => indSelectedUoas === null || indSelectedUoas.includes(d.uoa)
								)
							}))
							.filter((ind) => ind.dots.length > 0)
					}))
					.filter((f) => f.indicators.length > 0)
			}))
			.filter((s) => s.factors.length > 0)
	);

	const totalIndicators = $derived(
		filteredBlocks.reduce(
			(acc, s) => acc + s.factors.reduce((a, f) => a + f.indicators.length, 0),
			0
		)
	);

	// ── Section 4: Coverage ───────────────────────────────────────────────────

	let coverageUoa = $state('');
	let showAvailableOnly = $state(false);
	let showCoverageTable = $state(false);

	const coverageUoaOptions = $derived([
		...new Set(flagged.map((r) => String(r['uoa'] ?? '')))
	] as string[]);

	$effect(() => {
		if (coverageUoaOptions.length > 0 && !coverageUoa) {
			coverageUoa = coverageUoaOptions[0] ?? '';
		}
	});

	const coverageSelectedRow = $derived(
		flagged.find((r) => String(r['uoa']) === coverageUoa) ?? null
	);

	function filterAvailable(node: any, row: Record<string, any> | null): any | null {
		if (!node) return null;
		if (node.indicator) {
			const flagLabel = row ? String(row[`${node.id}_status`] ?? 'no_data') : 'no_data';
			return flagLabel === 'no_data' ? null : node;
		}
		if (!node.children) return node;
		const kept = node.children.map((c: any) => filterAvailable(c, row)).filter(Boolean);
		return kept.length > 0 ? { ...node, children: kept } : null;
	}

	const circlePackingDisplayData = $derived(
		circlePackingStore.data
			? showAvailableOnly && coverageSelectedRow
				? filterAvailable(circlePackingStore.data, coverageSelectedRow)
				: circlePackingStore.data
			: null
	);

	const coverageTableRows = $derived.by(() => {
		if (!indicatorsJson) return [];
		const baseRows = buildIndicatorRows(indicatorsJson);
		const row = coverageSelectedRow;
		return baseRows
			.map((r) => ({
				System: r.system,
				Factor: r.factor,
				Indicator: r.indicator,
				Label: r.indicator_label,
				Status: row ? String(row[`${r.indicator}_status`] ?? 'no_data') : 'no_data'
			}))
			.filter((r) => !showAvailableOnly || r.Status !== 'no_data');
	});

	// ── Section 5: Export ─────────────────────────────────────────────────────

	const allUoas = $derived([...new Set(flagged.map((r) => String(r['uoa'] ?? '')))]);
	let exportSelectedUoas = $derived(allUoas) as string[];
	const timestamp = $derived(new Date().toISOString().split('T')[0]);

	function handleJSON() {
		if (!flagStore.flaggedResult) return;
		downloadJSON(flagStore.flaggedResult, `flagged_data_${timestamp}.json`);
	}
	function handleCSV() {
		if (!flagStore.flaggedResult) return;
		downloadCSV(flagStore.flaggedResult, `flagged_data_${timestamp}.csv`);
	}
	function handleXLSX() {
		if (!flagStore.flaggedResult) return;
		downloadXLSX(flagStore.flaggedResult, `flagged_data_${timestamp}.xlsx`);
	}
	async function handleDeepDive() {
		if (!flagStore.flaggedResult || exportSelectedUoas.length === 0) return;
		const json = indicatorsStore.indicatorsJson;
		if (!json) return;
		const rows = flagStore.flaggedResult.filter((r) =>
			exportSelectedUoas.includes(String(r['uoa'] ?? ''))
		);
		if (rows.length === 0) return;
		const hypothesesResp = await fetch(asset('/data/hypotheses.json'));
		const hypothesesData = await hypothesesResp.json();
		await downloadDeepDiveZip(rows, json, hypothesesData, `deepdives_${timestamp}.zip`);
	}

	// ── Scroll spy ────────────────────────────────────────────────────────────

	$effect(() => {
		const sectionIds = ['overview', 'systems', 'indicators', 'coverage', 'export'] as const;

		// Scroll spy observers (persistent)
		const spyObservers = sectionIds.map((id) => {
			const el = document.getElementById(id);
			if (!el) return null;
			const obs = new IntersectionObserver(
				([entry]) => {
					if (entry.isIntersecting) exploreNav.activeSection = id;
				},
				{ rootMargin: '-20% 0px -60% 0px' }
			);
			obs.observe(el);
			return obs;
		});

		return () => {
			spyObservers.forEach((o) => o?.disconnect());
		};
	});

	onMount(() => {
		loadIndicatorsIntoStore();
		loadCirclePackingData(asset('/data/indicators-circlepacking.json'));
	});
</script>

<svelte:head>
	<title>Results | ANA</title>
</svelte:head>

<DataGuard {hasData} variant="none">
	<div class="space-y-16">
		<!-- ══════════════════════════════════════════════════════════════════════
		     Section 1 — Overview
		     ══════════════════════════════════════════════════════════════════════ -->
		<section id="overview" class="scroll-mt-28">
			<h2 class="text-base-content/40 mb-6 text-xs font-semibold tracking-widest uppercase">
				Overview
			</h2>

			<!-- Filters -->
			<div class="bg-base-200/60 border-base-300 rounded-box mb-6 border px-5 py-4">
				<div class="flex flex-wrap items-end gap-4">
					<div class="max-w-72 min-w-48 flex-1">
						<Select
							label="Units of analysis"
							options={overviewUoaOptions}
							selected={overviewSelectedUoas ?? overviewUoaOptions.map((o) => o.value)}
							placeholder="All UOAs"
							onchange={onOverviewUoasChange}
						/>
					</div>
					<div class="max-w-72 min-w-48 flex-1">
						<Select
							label="Classification"
							options={prelimOptions}
							selected={selectedPrelimKeys ?? PRELIM_KEYS}
							placeholder="All classifications"
							onchange={onPrelimKeysChange}
						/>
					</div>
					{#if metadataCols.length > 0}
						<div class="max-w-70 min-w-48 flex-1">
							<Select
								label="Filter by column"
								selected={groupByCol ?? ''}
								placeholder="(no extra filter)"
								options={metadataCols.map((c) => ({ value: c, label: c }))}
								onchange={(v) => (groupByCol = (Array.isArray(v) ? v[0] : v) || null)}
							/>
						</div>
						{#if groupByCol !== null && groupByOptions.length > 0}
							<div class="max-w-70 min-w-48 flex-1">
								<Select
									label="Filter values"
									options={groupByOptions}
									selected={selectedGroupValues}
									placeholder="Select values…"
									onchange={onGroupValuesChange}
								/>
							</div>
						{/if}
					{/if}
					{#if isFiltered}
						<div class="flex items-end gap-2 pb-1">
							<span class="text-base-content/50 text-sm">
								<strong>{filteredFlagged.length}</strong> / {flagged.length} UOAs
							</span>
							<ButtonClear
								label="Clear all"
								onclick={() => {
									overviewSelectedUoas = null;
									selectedPrelimKeys = null;
									groupByCol = null;
								}}
							/>
						</div>
					{/if}
				</div>
			</div>

			<!-- Donut + ranking table -->
			<div class="mb-6">
				<PrelimFlagDonut
					rows={filteredFlagged}
					selectedKeys={selectedPrelimKeys}
					onsliceclick={handleDonutSliceClick}
				/>
			</div>

			<UoaRankingTable rows={filteredFlagged} {systems} {systemCodes} onselect={selectInHeatmap} />

			<!-- Choropleth map -->
			{#if hasPcodes && adminFeaturesStore.fetchState !== 'error'}
				<div class="card bg-base-100 border-base-300 mt-6 border shadow-sm">
					<div class="card-body">
						<h3 class="card-title text-base">Preliminary classification map</h3>
						<p class="text-base-content/60 text-sm">Click an area to view its report.</p>
						{#if adminFeaturesStore.fetchState === 'loading'}
							<div class="text-base-content/50 flex items-center gap-2 py-6 text-sm">
								<span class="loading loading-spinner loading-sm"></span>
								Fetching admin boundaries…
							</div>
						{:else if adminFeaturesStore.adm1}
							<ChoroplethMap
								adm1={adminFeaturesStore.adm1}
								adm2={adminFeaturesStore.adm2}
								rows={filteredFlagged}
								level={pcodeLevel}
								onuoaclick={(uoa) => (selectedMapUoa = selectedMapUoa === uoa ? null : uoa)}
							/>
							{#if selectedMapRow}
								<div class="mt-4">
									<UoaDetailPanel
										uoa={selectedMapUoa!}
										row={selectedMapRow}
										{systems}
										{systemCodes}
										ondrilldown={selectInHeatmap}
										onclose={() => (selectedMapUoa = null)}
									/>
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/if}
		</section>

		<!-- ══════════════════════════════════════════════════════════════════════
		     Section 2 — Systems
		     ══════════════════════════════════════════════════════════════════════ -->
		<section id="systems" class="scroll-mt-28">
			<h2 class="text-base-content/40 mb-6 text-xs font-semibold tracking-widest uppercase">
				Systems
			</h2>

			<div class="mb-6">
				<SystemCoverageBars rows={filteredFlagged} {systems} />
			</div>

			<div class="card bg-base-100 border-base-300 border shadow-sm">
				<div class="card-body">
					<SystemMatrix
						rows={filteredFlagged}
						{systems}
						{systemCodes}
						{subList}
						{indicatorsJson}
						bind:selectedUoa={heatmapSelectedUoa}
						bind:selectedSystem={heatmapSelectedSystem}
					/>
				</div>
			</div>
		</section>

		<!-- ══════════════════════════════════════════════════════════════════════
		     Section 3 — Indicators
		     ══════════════════════════════════════════════════════════════════════ -->
		<section id="indicators" class="scroll-mt-28">
			<h2 class="text-base-content/40 mb-6 text-xs font-semibold tracking-widest uppercase">
				Indicators
			</h2>

			<div class="space-y-6">
				<!-- Filters -->
				<div class="bg-base-200/60 border-base-300 rounded-box border px-5 py-4">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<Select
							label="Systems"
							options={indSystemOptions}
							selected={indSelectedSystems ?? indSystemOptions.map((o) => o.value)}
							placeholder="Select systems…"
							onchange={onIndSystemsChange}
						/>
						<Select
							label="Factors"
							options={indFactorOptions}
							selected={indSelectedFactors ?? indFactorOptions.map((o) => o.value)}
							placeholder="Select factors…"
							onchange={onIndFactorsChange}
						/>
						<Select
							label="Units of Analysis"
							options={indUoaOptions}
							selected={indSelectedUoas ?? indUoaOptions.map((o) => o.value)}
							placeholder="Select UOAs…"
							onchange={onIndUoasChange}
						/>
					</div>
					<p class="text-primary mt-2 text-xs">
						Showing {totalIndicators} indicator{totalIndicators !== 1 ? 's' : ''}
						across {filteredBlocks.length} system{filteredBlocks.length !== 1 ? 's' : ''}
						for {(indSelectedUoas ?? indUoaOptions).length} UOA{(indSelectedUoas ?? indUoaOptions)
							.length !== 1
							? 's'
							: ''}
					</p>
				</div>

				<LegendBadge keys={['no_flag', 'flag']} btnCircle size="text-sm">
					{#snippet extra()}
						<span class="flex items-center gap-1.5">
							<span
								class="inline-block h-3 w-3 rounded-full ring-2 ring-(--color-within10) ring-offset-1"
							></span>
							Within 10% of threshold
						</span>
						<span class="flex items-center gap-1.5">
							<span class="h-4 border-l-2 border-dashed border-(--color-within10)"></span>
							<span class="font-mono text-xs text-(--color-within10)">AN</span> threshold
						</span>
					{/snippet}
				</LegendBadge>

				{#if filteredBlocks.length === 0}
					<div class="alert alert-warning alert-soft">
						<span
							>No indicators match the current filters. Try selecting more systems, factors, or
							UOAs.</span
						>
					</div>
				{:else}
					{#each filteredBlocks as sys (sys.systemId)}
						<section>
							<h3 class="border-base-300 mb-4 border-b-2 pb-2 text-2xl font-bold">
								{sys.systemLabel}
							</h3>
							<div class="space-y-8">
								{#each sys.factors as fac (fac.factorId)}
									<div>
										<h4 class="text-base-content/70 mb-3 text-lg font-semibold">
											{fac.factorLabel}
										</h4>
										<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
											{#each fac.indicators as ind (ind.id)}
												<div
													class="border-base-200 bg-base-100 rounded-lg border px-4 pt-3 pb-1 shadow-sm"
												>
													<div class="mb-1 flex flex-wrap items-baseline gap-2">
														<span class="text-sm font-semibold">{ind.label}</span>
														<span class="text-base-content/80 font-mono text-xs">{ind.id}</span>
														{#if ind.metric}
															<span class="text-base-content/80 text-xs italic">— {ind.metric}</span
															>
														{/if}
														<span class="text-base-content/80 ml-auto text-xs">
															{ind.dots.length} UOA{ind.dots.length !== 1 ? 's' : ''}
														</span>
													</div>
													<IndicatorStrip
														threshold={ind.threshold}
														direction={ind.direction}
														dots={ind.dots}
														height={120}
													/>
												</div>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</section>
					{/each}
				{/if}
			</div>
		</section>

		<!-- ══════════════════════════════════════════════════════════════════════
		     Section 4 — Coverage
		     ══════════════════════════════════════════════════════════════════════ -->
		<section id="coverage" class="scroll-mt-28">
			<h2 class="text-base-content/40 mb-6 text-xs font-semibold tracking-widest uppercase">
				Coverage
			</h2>

			<!-- coverage content -->
			{#if circlePackingStore.loading}
				<div class="flex items-center justify-center gap-3 py-16">
					<span class="loading loading-spinner loading-md text-primary"></span>
					<p class="text-base-content/60 text-sm">Loading indicator framework…</p>
				</div>
			{:else if circlePackingStore.error}
				<p class="text-error text-sm">{circlePackingStore.error}</p>
			{:else}
				<div class="space-y-4">
					<!-- Controls -->
					<div class="bg-base-200/60 border-base-300 rounded-box border px-5 py-4">
						<div class="flex flex-wrap items-end gap-6">
							<div class="max-w-72 min-w-60 flex-1">
								<Select
									label="Unit of analysis"
									options={coverageUoaOptions.map((uoa) => ({ value: uoa, label: uoa }))}
									selected={coverageUoa}
									placeholder="Select UOA…"
									onchange={(val) => (coverageUoa = Array.isArray(val) ? (val[0] ?? '') : val)}
								/>
							</div>
							<RadioToggle
								bind:value={showAvailableOnly}
								label="Show"
								labelFalse="All indicators"
								labelTrue="Available only"
								name="availability"
							/>
							<RadioToggle
								bind:value={showCoverageTable}
								label="View"
								labelFalse="Chart"
								labelTrue="Table"
								name="coverageView"
							/>
						</div>
					</div>

					<LegendBadge />

					{#if showCoverageTable}
						<div class="card bg-base-100 border-base-300 border shadow-sm">
							<div class="card-body rounded-box overflow-hidden p-0">
								<DataTable
									rows={coverageTableRows}
									searchable
									overflow="scroll"
									scrollHeight="500px"
									tableClass="table-sm"
								/>
							</div>
						</div>
					{:else}
						<div class="card bg-base-100 border-base-300 border shadow-sm">
							<div class="card-body rounded-box overflow-hidden p-0">
								<CirclePacking
									data={circlePackingDisplayData}
									flagRow={coverageSelectedRow}
									nodePadding={4}
									paddingByDepth={{ 0: 60, 1: 40, 2: 5, 3: 5 }}
								/>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</section>

		<!-- ══════════════════════════════════════════════════════════════════════
		     Section 5 — Export
		     ══════════════════════════════════════════════════════════════════════ -->
		<section id="export" class="scroll-mt-28 pb-[100vh]">
			<h2 class="text-base-content/40 mb-6 text-xs font-semibold tracking-widest uppercase">
				Export
			</h2>

			<div class="space-y-6">
				<!-- Stat bar -->
				<div
					class="bg-base-200/60 border-base-300 rounded-box flex items-center gap-3 border px-5 py-3"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-success size-5 shrink-0"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline
							points="22 4 12 14.01 9 11.01"
						/>
					</svg>
					<p class="text-sm">
						<strong>{flagged.length}</strong> unit{flagged.length !== 1 ? 's' : ''} of analysis processed
						and ready to export.
					</p>
				</div>

				<!-- Flat exports -->
				<div>
					<p class="text-base-content/75 mb-3 font-semibold uppercase">Export dataset</p>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<button
							class="group border-base-300 hover:border-primary hover:bg-primary/5 rounded-box flex cursor-pointer items-start gap-4 border px-5 py-4 text-left transition-colors duration-150"
							onclick={handleJSON}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-base-content/35 group-hover:text-primary mt-0.5 size-7 shrink-0 transition-colors duration-150"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline
									points="14 2 14 8 20 8"
								/>
								<line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
							</svg>
							<div>
								<p class="text-sm font-semibold">JSON</p>
								<p class="text-base-content/75 mt-0.5 text-sm">
									Nested hierarchical format. Ideal for programmatic use.
								</p>
							</div>
						</button>

						<button
							class="group border-base-300 hover:border-primary hover:bg-primary/5 rounded-box flex cursor-pointer items-start gap-4 border px-5 py-4 text-left transition-colors duration-150"
							onclick={handleCSV}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-base-content/35 group-hover:text-primary mt-0.5 size-7 shrink-0 transition-colors duration-150"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<rect x="3" y="3" width="18" height="18" rx="2" />
								<line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
								<line x1="9" y1="3" x2="9" y2="21" />
							</svg>
							<div>
								<p class="text-sm font-semibold">CSV</p>
								<p class="text-base-content/75 mt-0.5 text-sm">
									Flat tabular. One row per UOA. Compatible with Excel, R, Python.
								</p>
							</div>
						</button>

						<button
							class="group border-base-300 hover:border-primary hover:bg-primary/5 rounded-box flex cursor-pointer items-start gap-4 border px-5 py-4 text-left transition-colors duration-150"
							onclick={handleXLSX}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="text-base-content/35 group-hover:text-primary mt-0.5 size-7 shrink-0 transition-colors duration-150"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline
									points="14 2 14 8 20 8"
								/>
								<path d="M8 13l2 2 4-4" />
							</svg>
							<div>
								<p class="text-sm font-semibold">Excel (XLSX)</p>
								<p class="text-base-content/75 mt-0.5 text-sm">
									Native workbook. Useful for sharing with non-technical audiences.
								</p>
							</div>
						</button>
					</div>
				</div>

				<!-- Deep dives -->
				<div>
					<p class="text-base-content/75 mb-3 font-semibold uppercase">Deep-dive workbooks</p>
					<div class="card bg-base-100 border-base-300 border shadow-sm">
						<div class="card-body gap-4">
							<div>
								<h3 class="font-semibold">Pre-populated XLSX per unit of analysis</h3>
								<p class="text-base-content/80 mt-1 text-sm">
									One workbook per selected UOA, pre-filled with indicator values and preliminary
									flags. Delivered as a single ZIP archive.
								</p>
							</div>
							<div class="flex flex-wrap items-end gap-4">
								<div class="max-w-72 min-w-60 flex-1">
									<Select
										label="Units of analysis"
										options={allUoas.map((v) => ({ value: v, label: v }))}
										selected={exportSelectedUoas}
										onchange={(v) => (exportSelectedUoas = Array.isArray(v) ? v : [v])}
									/>
								</div>
								<button
									class="btn btn-secondary btn-sm"
									disabled={exportSelectedUoas.length === 0}
									onclick={handleDeepDive}
								>
									Download ZIP ({exportSelectedUoas.length} UOA{exportSelectedUoas.length !== 1
										? 's'
										: ''})
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	</div>
</DataGuard>
