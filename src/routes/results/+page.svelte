<script lang="ts">
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import { flagStore } from '$lib/stores/flagStore.svelte';
	import { metricStore, loadMetrics } from '$lib/stores/metricStore.svelte';
	import { circlePackingStore, loadCirclePackingData } from '$lib/stores/circlePackingStore.svelte';
	import {
		adminFeaturesStore,
		setAdminFeatures,
		setAdminFetchState,
		uoaLabel
	} from '$lib/stores/adminFeaturesStore.svelte';
	import ExploreNav from '$lib/components/ui/ExploreNav.svelte';
	import exploreNav from '$lib/stores/exploreNav.svelte';

	import DataGuard from '$lib/components/ui/DataGuard.svelte';

	import ResultsOverview from '$lib/components/results/ResultsOverview.svelte';
	import ResultsSystems from '$lib/components/results/ResultsSystems.svelte';
	import ResultsMetrics from '$lib/components/results/ResultsMetrics.svelte';
	import ResultsCoverage from '$lib/components/results/ResultsCoverage.svelte';
	import ResultsExport from '$lib/components/results/ResultsExport.svelte';
	import FiltersSidebar from '$lib/components/results/FiltersSidebar.svelte';

	import { analyzeUoas } from '$lib/utils/pcode';
	import { fetchAdminsForCountry } from '$lib/engine/fetchAdmin';
	import { buildSubfactorList } from '$lib/engine/metricMetadata';
	import { revealOnScroll } from '$lib/utils/revealOnScroll.svelte';
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

	interface DotData {
		uoa: string;
		value: number;
		flagLabel: string;
		within10: boolean | null;
	}
	interface MetricBlock {
		id: string;
		label: string | null;
		indicatorLabel: string;
		threshold: number | null;
		direction: string | null;
		dots: DotData[];
	}
	interface SubfactorBlock {
		subfactorId: string;
		subfactorLabel: string;
		metrics: MetricBlock[];
	}
	interface FactorBlock {
		factorId: string;
		factorLabel: string;
		subfactors: SubfactorBlock[];
	}
	interface SystemBlock {
		systemId: string;
		systemLabel: string;
		factors: FactorBlock[];
	}

	// ── Core store derivations ────────────────────────────────────────────────

	const flagged = $derived(flagStore.flaggedResult ?? ([] as Row[]));
	const referenceJson = $derived(metricStore.referenceJson);
	const metadataCols = $derived(flagStore.metadataCols ?? ([] as string[]));
	const hasData = $derived(flagStore.flaggedResult !== null && flagged.length > 0);

	const systems = $derived<System[]>(
		Array.isArray(referenceJson?.systems)
			? (referenceJson.systems as any[]).map((s) => ({ id: s.id, label: s.label ?? s.id }))
			: []
	);

	const subList = $derived<{ path: string; codes: string[] }[]>(
		referenceJson ? (buildSubfactorList(referenceJson) ?? []) : []
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
			map((r: Row) => {
				const pcode = String(r.uoa);
				return { value: pcode, label: uoaLabel(pcode) };
			})
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
	let selectedMapAdminName = $state<string | null>(null);

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

	// ── Section 3: Metrics ──────────────────────────────────────────────────────

	function buildSystemBlocks(rows: Row[], json: Record<string, unknown>): SystemBlock[] {
		const blocks: SystemBlock[] = [];
		for (const sys of Array.isArray(json['systems']) ? (json['systems'] as any[]) : []) {
			if (!sys) continue;
			const factorBlocks: FactorBlock[] = [];
			for (const fac of Array.isArray(sys.factors) ? (sys.factors as any[]) : []) {
				if (!fac) continue;
				const subfactorBlocks: SubfactorBlock[] = [];
				for (const sub of Array.isArray(fac.sub_factors) ? (fac.sub_factors as any[]) : []) {
					if (!sub) continue;
					const metricBlocks: MetricBlock[] = [];
					for (const ind of Array.isArray(sub.indicators) ? (sub.indicators as any[]) : []) {
						if (!ind) continue;
						const indicatorLabel: string = ind.label ?? ind.id;
						for (const met of Array.isArray(ind.metrics) ? (ind.metrics as any[]) : []) {
							if (!met?.metric) continue;
							const dots = rows
								.map((row: Row) => {
									const value = row[met.metric];
									const flagLabel: string = String(row[`${met.metric}_status`] ?? 'no_data');
									const w10 = row[`${met.metric}_within_10perc`];
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
							metricBlocks.push({
								id: met.metric,
								label: met.label ?? null,
								indicatorLabel,
								threshold: typeof met.thresholds?.an === 'number' ? met.thresholds.an : null,
								direction: met.above_or_below ?? null,
								dots
							});
						}
					}
					if (metricBlocks.length === 0) continue;
					subfactorBlocks.push({
						subfactorId: sub.id,
						subfactorLabel: sub.label ?? sub.id,
						metrics: metricBlocks
					});
				}
				if (subfactorBlocks.length === 0) continue;
				factorBlocks.push({
					factorId: fac.id,
					factorLabel: fac.label ?? fac.id,
					subfactors: subfactorBlocks
				});
			}
			if (factorBlocks.length === 0) continue;
			blocks.push({ systemId: sys.id, systemLabel: sys.label ?? sys.id, factors: factorBlocks });
		}
		return blocks;
	}

	const allBlocks = $derived(
		hasData && referenceJson
			? buildSystemBlocks(filteredFlagged, referenceJson as Record<string, unknown>)
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
			map((r: Row) => {
				const pcode = String(r.uoa);
				return { value: pcode, label: uoaLabel(pcode) };
			})
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
						subfactors: f.subfactors
							.map((sf) => ({
								...sf,
								metrics: sf.metrics
									.map((met) => ({
										...met,
										dots: met.dots.filter(
											(d) => indSelectedUoas === null || indSelectedUoas.includes(d.uoa)
										)
									}))
									.filter((met) => met.dots.length > 0)
							}))
							.filter((sf) => sf.metrics.length > 0)
					}))
					.filter((f) => f.subfactors.length > 0)
			}))
			.filter((s) => s.factors.length > 0)
	);

	const totalMetrics = $derived(
		filteredBlocks.reduce(
			(acc, s) =>
				acc +
				s.factors.reduce((a, f) => a + f.subfactors.reduce((b, sf) => b + sf.metrics.length, 0), 0),
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
		if (node.metric) {
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
		const json = metricStore.referenceJson;
		if (!json) return;
		const rows = flagStore.flaggedResult.filter((r) =>
			exportSelectedUoas.includes(String(r['uoa'] ?? ''))
		);
		if (rows.length === 0) return;
		const hypothesesResp = await fetch(asset('/data/hypotheses.json'));
		const hypothesesData = await hypothesesResp.json();
		await downloadDeepDiveZip(rows, json, hypothesesData, `deepdives_${timestamp}.zip`);
	}

	// ── Filters sidebar visibility (hide when Coverage or Export section enters viewport) ──
	let filtersVisible = $state(true);

	$effect(() => {
		const intersecting = new Set<string>();
		const obs = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const id = (entry.target as HTMLElement).id;
					if (entry.isIntersecting) intersecting.add(id);
					else intersecting.delete(id);
				}
				filtersVisible = intersecting.size === 0;
			},
			{ rootMargin: '0px 0px -80% 0px' }
		);
		const els = ['coverage', 'export'].map((id) => document.getElementById(id)).filter(Boolean);
		els.forEach((el) => obs.observe(el!));
		return () => obs.disconnect();
	});

	// ── Scroll spy ────────────────────────────────────────────────────────────

	$effect(() => {
		const sectionIds = ['overview', 'systems', 'metrics', 'coverage', 'export'] as const;

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
		loadMetrics();
		loadCirclePackingData(asset('/data/reference-circlepacking.json'));
	});
</script>

<svelte:head>
	<title>Results | ANA</title>
</svelte:head>

<DataGuard {hasData} variant="none">
	<!-- Explore sub-nav: sticky, full viewport width -->
	<div class="bg-base-100/90 border-base-300 sticky top-14 z-20 w-full border-b backdrop-blur-sm">
		<div class="mx-auto max-w-5xl px-6">
			<ExploreNav activeSection={exploreNav.activeSection} />
		</div>
	</div>

	<FiltersSidebar
		visible={filtersVisible && hasData}
		flaggedTotal={flagged.length}
		filteredTotal={filteredFlagged.length}
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
		onoverviewuoaschange={onOverviewUoasChange}
		onprelimkeyschange={onPrelimKeysChange}
		ongroupbycol={(v) => (groupByCol = v)}
		ongroupvalueschange={onGroupValuesChange}
		onclearfilters={() => {
			overviewSelectedUoas = null;
			selectedPrelimKeys = null;
			groupByCol = null;
		}}
	/>

	<!-- Overview -->
	<div class="bg-base-200/30 border-base-300 border-y py-16">
		<div
			class="mx-auto max-w-5xl px-4"
			{@attach revealOnScroll({ y: 36, duration: 650, rootMargin: '0px 0px -25% 0px' })}
		>
			<ResultsOverview
				{filteredFlagged}
				{systems}
				{systemCodes}
				{hasPcodes}
				{pcodeLevel}
				{selectedPrelimKeys}
				{selectedMapUoa}
				{selectedMapAdminName}
				{selectedMapRow}
				onselectinheatmap={selectInHeatmap}
				onmapselect={(uoa, adminName) => {
					if (selectedMapUoa === uoa) {
						selectedMapUoa = null;
						selectedMapAdminName = null;
					} else {
						selectedMapUoa = uoa;
						selectedMapAdminName = adminName;
					}
				}}
				onmapclear={() => {
					selectedMapUoa = null;
					selectedMapAdminName = null;
				}}
				ondonutsliceclick={handleDonutSliceClick}
			/>
		</div>
	</div>

	<!-- Systems -->
	<div class="py-16">
		<div
			class="mx-auto max-w-5xl px-4"
			{@attach revealOnScroll({ y: 36, duration: 650, rootMargin: '0px 0px -25% 0px' })}
		>
			<ResultsSystems
				{filteredFlagged}
				{systems}
				{systemCodes}
				{subList}
				{referenceJson}
				bind:selectedUoa={heatmapSelectedUoa}
				bind:selectedSystem={heatmapSelectedSystem}
			/>
		</div>
	</div>

	<!-- Metrics -->
	<div class="bg-base-200/30 border-base-300 border-y py-16">
		<div
			class="mx-auto max-w-5xl px-4"
			{@attach revealOnScroll({ y: 36, duration: 650, rootMargin: '0px 0px -25% 0px' })}
		>
			<ResultsMetrics
				{filteredBlocks}
				{indSystemOptions}
				{indFactorOptions}
				{indUoaOptions}
				{indSelectedSystems}
				{indSelectedFactors}
				{indSelectedUoas}
				{totalMetrics}
				onindsystemschange={onIndSystemsChange}
				onindfactorschange={onIndFactorsChange}
				oninduoaschange={onIndUoasChange}
			/>
		</div>
	</div>

	<!-- Coverage -->
	<div class="py-16">
		<div
			class="mx-auto max-w-5xl px-4"
			{@attach revealOnScroll({ y: 36, duration: 650, rootMargin: '0px 0px -25% 0px' })}
		>
			<ResultsCoverage
				{coverageUoaOptions}
				{coverageUoa}
				bind:showAvailableOnly
				bind:showCoverageTable
				{circlePackingDisplayData}
				{coverageSelectedRow}
				{systems}
				{referenceJson}
				oncoverageUoaChange={(v) => (coverageUoa = v)}
			/>
		</div>
	</div>

	<!-- Export -->
	<div class="bg-base-200/30 border-base-300 border-y py-16">
		<div
			class="mx-auto max-w-5xl px-4"
			{@attach revealOnScroll({ y: 36, duration: 650, rootMargin: '0px 0px -25% 0px' })}
		>
			<ResultsExport
				{flagged}
				{allUoas}
				{exportSelectedUoas}
				{handleJSON}
				{handleCSV}
				{handleXLSX}
				{handleDeepDive}
				onexportUoasChange={(v) => (exportSelectedUoas = Array.isArray(v) ? v : [v])}
			/>
		</div>
	</div>
</DataGuard>
