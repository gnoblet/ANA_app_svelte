<script lang="ts">
	import { onMount } from 'svelte';
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

	import ResultsOverview from '$lib/components/results/ResultsOverview.svelte';
	import ResultsSystems from '$lib/components/results/ResultsSystems.svelte';
	import ResultsIndicators from '$lib/components/results/ResultsIndicators.svelte';
	import ResultsCoverage from '$lib/components/results/ResultsCoverage.svelte';
	import ResultsExport from '$lib/components/results/ResultsExport.svelte';
	import ResultsFilterPanel from '$lib/components/results/ResultsFilterPanel.svelte';

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
			? buildSystemBlocks(filteredFlagged, indicatorsJson as Record<string, unknown>)
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
			filteredFlagged,
			distinct(['uoa']),
			arrange(asc('uoa')),
			map((r: Row) => ({ value: String(r.uoa), label: String(r.uoa) }))
		)
	);

	let indSelectedSystems = $state<string[] | null>(null);
	let indSelectedFactors = $state<string[] | null>(null);
	let indSelectedUoas = $state<string[] | null>(null);

	// ── Filtered systems/subList/systemCodes for ResultsSystems columns ────────
	const filteredSystems = $derived(
		indSelectedSystems === null
			? systems
			: systems.filter((s) => indSelectedSystems!.includes(s.id))
	);

	const filteredSubList = $derived(
		subList.filter(({ path }) => {
			const parts = String(path).split('.');
			if (indSelectedSystems !== null && !indSelectedSystems!.includes(parts[0])) return false;
			if (
				indSelectedFactors !== null &&
				!indSelectedFactors!.includes(`${parts[0]}.${parts[1]}`)
			)
				return false;
			return true;
		})
	);

	// Matrix columns filter by systems only (factor filter is drilldown-only)
	const matrixSubList = $derived(
		indSelectedSystems === null
			? subList
			: subList.filter(({ path }) => indSelectedSystems!.includes(String(path).split('.')[0]))
	);

	const filteredSystemCodes = $derived<Map<string, string[]>>(
		(() => {
			const tempMap = new Map<string, Set<string>>();
			for (const { path, codes } of matrixSubList) {
				const [systemId] = String(path).split('.');
				if (!tempMap.has(systemId)) tempMap.set(systemId, new Set());
				for (const c of codes) tempMap.get(systemId)!.add(c);
			}
			const result = new Map<string, string[]>();
			for (const [k, v] of tempMap.entries()) result.set(k, Array.from(v));
			return result;
		})()
	);

	const isFiltered = $derived(
		overviewSelectedUoas !== null ||
			selectedPrelimKeys !== null ||
			groupByCol !== null ||
			indSelectedSystems !== null ||
			indSelectedFactors !== null ||
			indSelectedUoas !== null
	);

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

	// ── Drilldown filters (shared sidebar → Systems section) ─────────────────

	let drillPrefFilter = $state<number[]>([1, 2]);
	let drillFlagFilter = $state<string[]>(['flag', 'no_flag']);

	function toggleDrillPref(p: number) {
		drillPrefFilter = drillPrefFilter.includes(p)
			? drillPrefFilter.filter((x) => x !== p)
			: [...drillPrefFilter, p];
	}

	function toggleDrillFlag(f: string) {
		drillFlagFilter = drillFlagFilter.includes(f)
			? drillFlagFilter.filter((x) => x !== f)
			: [...drillFlagFilter, f];
	}

	// ── Section 5: Coverage ───────────────────────────────────────────────────

	let coverageUoa = $state('');
	let showAvailableOnly = $state(false);
	let showCoverageTable = $state(false);

	const coverageUoaOptions = $derived(
		[...new Set(filteredFlagged.map((r) => String(r['uoa'] ?? '')))] as string[]
	);

	$effect(() => {
		if (coverageUoaOptions.length > 0 && !coverageUoaOptions.includes(coverageUoa)) {
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

	function filterBySystemFactor(node: any, depth: number): any | null {
		if (!node) return null;
		// depth 1 = system level, depth 2 = factor level
		if (depth === 1 && indSelectedSystems !== null) {
			if (!indSelectedSystems.includes(node.id)) return null;
		}
		if (depth === 2 && indSelectedFactors !== null) {
			const factorId = String(node.id).split('::')[1] ?? node.id;
			if (!indSelectedFactors.includes(factorId)) return null;
		}
		if (!node.children) return node;
		const kept = node.children.map((c: any) => filterBySystemFactor(c, depth + 1)).filter(Boolean);
		return kept.length > 0 ? { ...node, children: kept } : null;
	}

	const circlePackingDisplayData = $derived.by(() => {
		if (!circlePackingStore.data) return null;
		let data: any = circlePackingStore.data;
		// filter by systems/factors
		if (indSelectedSystems !== null || indSelectedFactors !== null) {
			const kept = (data.children ?? [])
				.map((c: any) => filterBySystemFactor(c, 1))
				.filter(Boolean);
			data = kept.length > 0 ? { ...data, children: kept } : null;
		}
		if (!data) return null;
		// filter by availability
		if (showAvailableOnly && coverageSelectedRow) {
			data = filterAvailable(data, coverageSelectedRow);
		}
		return data;
	});

	const coverageTableRows = $derived.by(() => {
		if (!indicatorsJson) return [];
		const baseRows = buildIndicatorRows(indicatorsJson);
		const row = coverageSelectedRow;
		return baseRows
			.filter(
				(r) =>
					(indSelectedSystems === null || indSelectedSystems.includes(r.system)) &&
					(indSelectedFactors === null || indSelectedFactors.includes(r.factor))
			)
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
	<div class="flex items-start gap-6">
		<!-- Sidebar filters -->
		<aside class="sticky top-28 w-64 shrink-0">
			<ResultsFilterPanel
				totalCount={flagged.length}
				filteredCount={filteredFlagged.length}
				{isFiltered}
				{overviewUoaOptions}
				{overviewSelectedUoas}
				{selectedPrelimKeys}
				{PRELIM_KEYS}
				{prelimOptions}
				{metadataCols}
				{groupByCol}
				{groupByOptions}
				{selectedGroupValues}
				{indSystemOptions}
				{indFactorOptions}
				{indUoaOptions}
				{indSelectedSystems}
				{indSelectedFactors}
				{indSelectedUoas}
				onoverviewuoaschange={onOverviewUoasChange}
				onprelimkeyschange={onPrelimKeysChange}
				ongroupbycol={(v) => (groupByCol = v)}
				ongroupvalueschange={onGroupValuesChange}
				onindsystemschange={onIndSystemsChange}
				onindfactorschange={onIndFactorsChange}
				oninduoaschange={onIndUoasChange}
				coverageUoaOptions={coverageUoaOptions}
				{coverageUoa}
				oncoverageUoaChange={(v) => (coverageUoa = v)}
				drillPrefFilter={drillPrefFilter}
				drillFlagFilter={drillFlagFilter}
				ontoggledrillpref={toggleDrillPref}
				ontoggledrillFlag={toggleDrillFlag}
				onclearfilters={() => {
					overviewSelectedUoas = null;
					selectedPrelimKeys = null;
					groupByCol = null;
					indSelectedSystems = null;
					indSelectedFactors = null;
					indSelectedUoas = null;
				}}
			/>
		</aside>

		<!-- Main content -->
		<div class="min-w-0 flex-1 space-y-16">
		<ResultsOverview
				{flagged}
				{filteredFlagged}
				{systems}
				{systemCodes}
				{hasPcodes}
				{pcodeLevel}
				{selectedPrelimKeys}
				{selectedMapUoa}
				{selectedMapRow}
				onselectinheatmap={selectInHeatmap}
				onmapselect={(uoa) => (selectedMapUoa = selectedMapUoa === uoa ? null : uoa)}
				onmapclear={() => (selectedMapUoa = null)}
				ondonutsliceclick={handleDonutSliceClick}
			/>

		<ResultsSystems
			{filteredFlagged}
			systems={filteredSystems}
			systemCodes={filteredSystemCodes}
			subList={filteredSubList}
			{indicatorsJson}
			prefFilter={drillPrefFilter}
			flagFilter={drillFlagFilter}
			bind:selectedUoa={heatmapSelectedUoa}
			bind:selectedSystem={heatmapSelectedSystem}
		/>

		<ResultsIndicators
				{filteredBlocks}
				{indUoaOptions}
				{indSelectedUoas}
				{totalIndicators}
			/>

		<ResultsCoverage
			bind:showAvailableOnly
			bind:showCoverageTable
			{circlePackingDisplayData}
			{coverageTableRows}
			{coverageSelectedRow}
		/>

		<ResultsExport
			{flagged}
			{allUoas}
			{exportSelectedUoas}
			{timestamp}
			{handleJSON}
			{handleCSV}
			{handleXLSX}
			{handleDeepDive}
			onexportUoasChange={(v) => (exportSelectedUoas = Array.isArray(v) ? v : [v])}
		/>
		</div>
	</div>
</DataGuard>
