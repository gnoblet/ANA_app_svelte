<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve, base } from '$app/paths';
	import NavButton from '$lib/components/ui/NavButton.svelte';
	import DataGuard from '$lib/components/ui/DataGuard.svelte';
	import FlagDownloadsCard from '$lib/components/data/FlagDownloadsCard.svelte';
	import { downloadJSON, downloadCSV, downloadXLSX } from '$lib/engine/download';
	import { downloadDeepDiveZip } from '$lib/engine/download';
	import Select from '$lib/components/ui/Select.svelte';
	import HeatMapWithDrilldown from '$lib/components/viz/HeatMapWithDrilldown.svelte';
	import PcodeMap from '$lib/components/viz/PcodeMap.svelte';
	import SummaryStatsBar from '$lib/components/viz/SummaryStatsBar.svelte';
	import UoaReportPanel from '$lib/components/viz/UoaReportPanel.svelte';
	import UoaRankingTable from '$lib/components/viz/UoaRankingTable.svelte';
	import PrelimFlagDonut from '$lib/components/viz/PrelimFlagDonut.svelte';
	import SystemCoverageBars from '$lib/components/viz/SystemCoverageBars.svelte';
	import { flagStore, clearFlagResult } from '$lib/stores/flagStore.svelte';
	import { indicatorsStore } from '$lib/stores/indicatorsStore.svelte';
	import { loadIndicatorsIntoStore } from '$lib/stores/indicatorsStore.svelte';
	import { buildSubfactorList } from '$lib/engine/indicatorMetadata';
	import { analyzeUoas } from '$lib/utils/pcode';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { fetchAdminsForCountry } from '$lib/engine/fetchAdmin';
	import {
		adminFeaturesStore,
		setAdminFeatures,
		setAdminFetchState
	} from '$lib/stores/adminFeaturesStore.svelte';
	import { tidy, filter, distinct, arrange, asc, map } from '@tidyjs/tidy';
	import ButtonClear from '$lib/components/ui/ButtonClear.svelte';

	onMount(() => {
		loadIndicatorsIntoStore();
	});

	type Row = Record<string, any>;
	type System = { id: string; label: string };

	const flagged = $derived(flagStore.flaggedResult ?? ([] as Row[]));
	const indicatorsJson = $derived(indicatorsStore.indicatorsJson);
	const uploadedAt = $derived(flagStore.uploadedAt);
	const filename = $derived(flagStore.filename);
	const metadataCols = $derived(flagStore.metadataCols ?? ([] as string[]));
	const hasData = $derived(flagStore.flaggedResult !== null && flagged.length > 0);

	// ── Pcode / map detection ─────────────────────────────────────────────────
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

	// ── Filter state ──────────────────────────────────────────────────────────

	/** Metadata group-by column (only relevant when metadataCols available). */
	let groupByCol: string | null = $state(null);

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

	/** All UOA options (after group-by filter). */
	const uoaOptions = $derived(
		tidy(
			groupByCol !== null
				? flagged.filter((r) => selectedGroupValues.includes(String(r[groupByCol!] ?? '')))
				: flagged,
			distinct(['uoa']),
			arrange(asc('uoa')),
			map((r: Row) => ({ value: String(r.uoa), label: String(r.uoa) }))
		)
	);

	/** null = all selected */
	let selectedUoas = $state<string[] | null>(null);

	function onUoasChange(next: string | string[]) {
		const arr = Array.isArray(next) ? next : [next];
		selectedUoas = arr.length === uoaOptions.length ? null : arr;
	}

	/** Prelim-flag filter — null = all. Driven by donut clicks or manual select. */
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

	/** Rows after all active filters. */
	const filteredFlagged = $derived.by<Row[]>(() => {
		let rows = flagged;
		if (groupByCol !== null && selectedGroupValues.length < groupByOptions.length) {
			rows = rows.filter((r) => selectedGroupValues.includes(String(r[groupByCol!] ?? '')));
		}
		if (selectedUoas !== null) {
			rows = rows.filter((r) => selectedUoas!.includes(String(r.uoa)));
		}
		if (selectedPrelimKeys !== null) {
			rows = rows.filter((r) => selectedPrelimKeys!.includes(String(r.prelim_flag ?? '')));
		}
		return rows;
	});

	const isFiltered = $derived(
		selectedUoas !== null || selectedPrelimKeys !== null || groupByCol !== null
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

	// ── Downloads ─────────────────────────────────────────────────────────────
	let _downloadUoas = $state<string[] | null>(null);

	const allUoaOptions = $derived.by((): string[] => {
		if (!flagged.length) return [];
		return [...new Set(flagged.map((r) => String(r['uoa'] ?? '')))];
	});

	const downloadUoas = $derived(_downloadUoas ?? allUoaOptions);

	function handleDownloadJSON() {
		if (!flagStore.flaggedResult) return;
		const timestamp = new Date().toISOString().split('T')[0];
		downloadJSON(flagStore.flaggedResult, `flagged_data_${timestamp}.json`);
	}

	function handleDownloadCSV() {
		if (!flagStore.flaggedResult) return;
		const timestamp = new Date().toISOString().split('T')[0];
		downloadCSV(flagStore.flaggedResult, `flagged_data_${timestamp}.csv`);
	}

	function handleDownloadXLSX() {
		if (!flagStore.flaggedResult) return;
		const timestamp = new Date().toISOString().split('T')[0];
		downloadXLSX(flagStore.flaggedResult, `flagged_data_${timestamp}.xlsx`);
	}

	async function handleDownloadDeepDiveZip() {
		if (!flagStore.flaggedResult || downloadUoas.length === 0) return;
		const json = indicatorsStore.indicatorsJson;
		if (!json) return;
		const rows = flagStore.flaggedResult.filter((r) =>
			downloadUoas.includes(String(r['uoa'] ?? ''))
		);
		if (rows.length === 0) return;
		const timestamp = new Date().toISOString().split('T')[0];
		const hypothesesResp = await fetch(`${base}/data/hypotheses.json`);
		const hypothesesData = await hypothesesResp.json();
		await downloadDeepDiveZip(rows, json, hypothesesData, `deepdives_${timestamp}.zip`);
	}

	function handleClear() {
		_downloadUoas = null;
		clearFlagResult();
	}

	// ── Map click → UOA report panel ─────────────────────────────────────────
	let selectedMapUoa = $state<string | null>(null);

	const selectedMapRow = $derived(
		selectedMapUoa !== null
			? (filteredFlagged.find((r) => String(r.uoa) === selectedMapUoa) ?? null)
			: null
	);

	// ── Shared heatmap selection ──────────────────────────────────────────────
	let heatmapSelectedUoa = $state<string | null>(null);
	let heatmapSelectedSystem = $state<string | null>(null);

	function selectInHeatmap(uoa: string, systemId: string) {
		heatmapSelectedUoa = uoa;
		heatmapSelectedSystem = systemId;
		document
			.getElementById('heatmap-section')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<PageHeader
	title="Results"
	subtitle="Explore the preliminary classification of your data, download results and prepopulate deep-dive files."
>
	{#snippet action()}
		<NavButton href={resolve('/')} label="Back to Validator" direction="back" />
	{/snippet}
</PageHeader>

<DataGuard {hasData} variant="none">
	<div class="space-y-6">
		<!-- Downloads + file metadata -->
		<FlagDownloadsCard
			count={flagged.length}
			uoaOptions={allUoaOptions}
			selectedUoas={downloadUoas}
			onUoasChange={(v) => (_downloadUoas = v)}
			onDownloadJSON={handleDownloadJSON}
			onDownloadCSV={handleDownloadCSV}
			onDownloadXLSX={handleDownloadXLSX}
			onDownloadDeepDive={handleDownloadDeepDiveZip}
			onClear={handleClear}
		/>
		{#if filename || uploadedAt}
			<div class="text-base-content/70 text-sm">
				{#if filename}<span class="font-medium">{filename}</span>{/if}
				{#if uploadedAt}
					<span class="ml-2">— Processed at {new Date(uploadedAt).toLocaleString()}</span>
				{/if}
			</div>
		{/if}

		<!-- Summary stats bar -->
		{#if filteredFlagged.length > 0}
			<SummaryStatsBar rows={filteredFlagged} />
		{/if}

		<!-- ── Filters + Overview charts (3-col grid) ─────────────────────── -->
		<div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
			<!-- Col 1: Filters card -->
			<div class="card bg-base-100 border-base-300/40 border shadow-sm">
				<div class="card-body">
					<h2 class="card-title">Filters</h2>
					<div class="flex flex-col gap-4">
						<!-- UOA multi-select (always visible) -->
						<Select
							label="Units of analysis"
							options={uoaOptions}
							selected={selectedUoas ?? uoaOptions.map((o) => o.value)}
							placeholder="All UOAs"
							onchange={onUoasChange}
						/>

						<!-- Prelim-flag filter (always visible) -->
						<Select
							label="Classification"
							options={prelimOptions}
							selected={selectedPrelimKeys ?? PRELIM_KEYS}
							placeholder="All classifications"
							onchange={onPrelimKeysChange}
						/>

						<!-- Metadata group-by (only when metadata columns exist) -->
						{#if metadataCols.length > 0}
							<Select
								label="Filter by column"
								selected={groupByCol ?? ''}
								placeholder="(no extra filter)"
								options={metadataCols.map((c) => ({ value: c, label: c }))}
								onchange={(v) => (groupByCol = (Array.isArray(v) ? v[0] : v) || null)}
							/>

							{#if groupByCol !== null && groupByOptions.length > 0}
								<Select
									label="Filter values"
									options={groupByOptions}
									selected={selectedGroupValues}
									placeholder="Select values…"
									onchange={onGroupValuesChange}
								/>
							{/if}
						{/if}

						<!-- Active-filter badge + reset -->
						{#if isFiltered}
							<div class="flex items-center gap-2">
								<span class="text-base-content/50 text-sm">
									<strong>{filteredFlagged.length}</strong> / {flagged.length} UOAs
								</span>
								<ButtonClear label="Clear all" onclick={() => {
									selectedUoas = null;
									selectedPrelimKeys = null;
									groupByCol = null;
								}} />
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Col 2: Classification donut -->
			<PrelimFlagDonut
				rows={filteredFlagged}
				selectedKeys={selectedPrelimKeys}
				onsliceclick={handleDonutSliceClick}
			/>

			<!-- Col 3: System coverage bars -->
			<SystemCoverageBars rows={filteredFlagged} {systems} {systemCodes} />
		</div>

		<!-- ── UOA ranking (full width below the 3-col grid) ────────────────── -->
		<UoaRankingTable rows={filteredFlagged} {systems} {systemCodes} onselect={selectInHeatmap} />

		<!-- Choropleth map -->
		{#if hasPcodes && adminFeaturesStore.fetchState !== 'error'}
			<div class="card bg-base-100 border-base-300/40 border shadow-sm">
				<div class="card-body">
					<h2 class="card-title">Preliminary classification map</h2>
					<p class="text-base-content/60 text-sm">Click an area to view its report.</p>
					{#if adminFeaturesStore.fetchState === 'loading'}
						<div class="text-base-content/50 flex items-center gap-2 py-6 text-sm">
							<span class="loading loading-spinner loading-sm"></span>
							Fetching admin boundaries…
						</div>
					{:else if adminFeaturesStore.adm1}
						<PcodeMap
							adm1={adminFeaturesStore.adm1}
							adm2={adminFeaturesStore.adm2}
							rows={filteredFlagged}
							level={pcodeLevel}
							onuoaclick={(uoa) => (selectedMapUoa = selectedMapUoa === uoa ? null : uoa)}
						/>
						{#if selectedMapRow}
							<div class="mt-4">
								<UoaReportPanel
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

		<!-- ── Heatmap + drilldown ───────────────────────────────────────────── -->
		<div id="heatmap-section">
			<HeatMapWithDrilldown
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
</DataGuard>
