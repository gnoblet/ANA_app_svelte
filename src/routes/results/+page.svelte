<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve, base } from '$app/paths';
	import NavButton from '$lib/components/ui/NavButton.svelte';
	import DataGuard from '$lib/components/ui/DataGuard.svelte';
	import FlagDownloadsCard from '$lib/components/data/FlagDownloadsCard.svelte';
	import FlagDataPreview from '$lib/components/data/FlagDataPreview.svelte';
	import { downloadJSON, downloadCSV, downloadXLSX } from '$lib/engine/download';
	import { downloadDeepDiveZip } from '$lib/engine/download';
	import Select from '$lib/components/ui/Select.svelte';
	import HeatMapWithDrilldown from '$lib/components/viz/HeatMapWithDrilldown.svelte';
	import PcodeMap from '$lib/components/viz/PcodeMap.svelte';
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
	import { tidy, filter, distinct, arrange, asc, map, select, everything } from '@tidyjs/tidy';
	// On page load, load indicators into the store
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

	// ── Pcode / map detection ──────────────────────────────────────────────────
	const uoaAnalysis = $derived(
		flagged.length > 0 ? analyzeUoas(flagged.map((r) => String(r.uoa))) : null
	);
	const hasPcodes = $derived(uoaAnalysis?.action === 'adm1' || uoaAnalysis?.action === 'adm2');
	const pcodeLevel = $derived<'ADM1' | 'ADM2'>(uoaAnalysis?.action === 'adm2' ? 'ADM2' : 'ADM1');

	// Derive a cache key from the first pcode found
	const pcodeKey = $derived.by(() => {
		if (!uoaAnalysis || !hasPcodes) return null;
		const first = (uoaAnalysis.parsed ?? []).find(
			(p: { parsed?: { isPcode?: boolean; code?: string } }) => p.parsed?.isPcode
		);
		const code = first?.parsed?.code ?? uoaAnalysis.pcode ?? null;
		return code ? `${code}_${pcodeLevel}` : null;
	});

	// Fallback: handles direct navigation to /viz (hard refresh, bookmark) when pipeline.ts
	// has not yet run. In the normal flow (navigating from /), pipeline.ts already started
	// the fetch and set cachedKey, so the guard below exits immediately as a no-op.
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
	// ── Group-by / value filter state ─────────────────────────────────────────

	/** The metadata column currently used for filtering, or null for no filter. */
	let groupByCol: string | null = $state(null);

	/** Distinct values of the selected groupByCol across all rows. */
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

	// ── UOA multi-select filter ───────────────────────────────────────────────

	// Options scoped to the active group-by selection: UOAs from deselected group
	// values are excluded automatically, so no cascade logic is needed.
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

	// null = all selected
	let selectedUoas = $state<string[] | null>(null);

	function onUoasChange(next: string | string[]) {
		const arr = Array.isArray(next) ? next : [next];
		selectedUoas = arr.length === uoaOptions.length ? null : arr;
	}

	/** Rows visible after applying the active filters (group-by + UOA) */
	const filteredFlagged = $derived.by<Row[]>(() => {
		let rows = flagged;
		if (groupByCol !== null && selectedGroupValues.length < groupByOptions.length) {
			rows = rows.filter((r) => selectedGroupValues.includes(String(r[groupByCol!] ?? '')));
		}
		if (selectedUoas !== null) {
			rows = rows.filter((r) => selectedUoas!.includes(String(r.uoa)));
		}
		return rows;
	});

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

	// ── Downloads / deep-dive (inlined from FlagView) ─────────────────────────

	/** null = user hasn't deselected anything yet → default to all UOAs */
	let _downloadUoas = $state<string[] | null>(null);

	const allUoaOptions = $derived.by((): string[] => {
		if (!flagged.length) return [];
		return [...new Set(flagged.map((r) => String(r['uoa'] ?? '')))];
	});

	/** Effective deep-dive UOA selection: user's choice, or all UOAs when untouched. */
	const downloadUoas = $derived(_downloadUoas ?? allUoaOptions);

	const orderedRows = $derived(
		tidy(flagged, select(['uoa', 'prelim_flag', everything()])) as Record<string, unknown>[]
	);

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
</script>

<PageHeader
	title="Flagged data - Dive into results"
	subtitle="Download flagged results & prepopulated deep-dive files and explore the preliminary classification of your data."
>
	{#snippet action()}
		<NavButton href={resolve('/')} label="Back to Validator" direction="back" />
	{/snippet}
</PageHeader>

<DataGuard {hasData} variant="none">
	<div class="space-y-6">
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
					<span class="ml-2"
						>— Data was processed and flagged at {new Date(uploadedAt).toLocaleString()}</span
					>
				{/if}
			</div>
		{/if}
		<FlagDataPreview rows={orderedRows} />

		<!-- Choropleth map — shown when pcode UOAs are detected and boundaries loaded successfully -->
		{#if hasPcodes && adminFeaturesStore.fetchState !== 'error'}
			<div class="card bg-base-100 border-base-300/40 border shadow-sm">
				<div class="card-body">
					<h2 class="card-title">Preliminary classification map</h2>
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
						/>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Group-by / value filter controls -->
		{#if metadataCols.length > 0}
			<div class="card bg-base-100 border-base-300/40 border shadow-sm">
				<div class="card-body">
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
								selected={selectedUoas ?? uoaOptions.map((o) => o.value)}
								placeholder="Select UOAs…"
								onchange={onUoasChange}
							/>
						</div>

						<!-- Active-filter badge -->
						{#if groupByCol !== null}
							<span class="text-base-content/50 self-end text-sm">
								Showing
								<strong>{filteredFlagged.length}</strong> / {flagged.length} UOAs
							</span>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<HeatMapWithDrilldown
			rows={filteredFlagged}
			{systems}
			{systemCodes}
			{subList}
			{indicatorsJson}
		/>
	</div>
</DataGuard>
