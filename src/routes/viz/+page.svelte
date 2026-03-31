<script lang="ts">
	import { onMount } from 'svelte';
	import FlagView from '$lib/components/FlagView.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import HeatMapWithDrilldown from '$lib/components/viz/HeatMapWithDrilldown.svelte';
	import PcodeMap from '$lib/components/viz/PcodeMap.svelte';
	import { flagStore } from '$lib/stores/flagStore.svelte';
	import { indicatorsStore } from '$lib/stores/indicatorsStore.svelte';
	import { loadIndicatorsIntoStore } from '$lib/stores/indicatorsStore.svelte';
	import { buildSubfactorList } from '$lib/access/access_indicators.js';
	import { analyzeUoas } from '$lib/utils/pcode';
	import { fetchAdminsForCountry } from '$lib/processing/fetch_admin';
	import {
		adminFeaturesStore,
		setAdminFeatures,
		setAdminFetchState
	} from '$lib/stores/adminFeaturesStore.svelte';
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
	const hasPcodes = $derived(
		uoaAnalysis?.action === 'adm1' || uoaAnalysis?.action === 'adm2'
	);
	const pcodeLevel = $derived<'ADM1' | 'ADM2'>(
		uoaAnalysis?.action === 'adm2' ? 'ADM2' : 'ADM1'
	);

	// Derive a cache key from the first pcode found
	const pcodeKey = $derived.by(() => {
		if (!uoaAnalysis || !hasPcodes) return null;
		const first = (uoaAnalysis.parsed ?? []).find((p: { parsed?: { isPcode?: boolean; code?: string } }) => p.parsed?.isPcode);
		const code = first?.parsed?.code ?? uoaAnalysis.pcode ?? null;
		return code ? `${code}_${pcodeLevel}` : null;
	});

	// Auto-fetch admin layers when pcode data is detected
	$effect(() => {
		if (!pcodeKey || !hasPcodes) return;
		if (
			adminFeaturesStore.fetchState === 'loading' ||
			adminFeaturesStore.cachedKey === pcodeKey
		)
			return;
		const first = (uoaAnalysis!.parsed ?? []).find((p: { parsed?: { isPcode?: boolean; code?: string } }) => p.parsed?.isPcode);
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
</script>

<div class="space-y-6 p-6">
	<!-- Flagging panel always shown at top -->
	<FlagView />

	{#if hasData}
		<!-- Choropleth map — shown first when pcode UOAs are detected -->
		{#if hasPcodes}
			<div class="card bg-white shadow">
				<div class="card-body">
					<div class="card-title">Preliminary classification map</div>
					{#if adminFeaturesStore.fetchState === 'loading'}
						<div class="text-base-content/50 flex items-center gap-2 py-6 text-sm">
							<span class="loading loading-spinner loading-sm"></span>
							Fetching admin boundaries…
						</div>
					{:else if adminFeaturesStore.fetchState === 'error'}
						<div class="text-error py-4 text-sm">
							Failed to load admin boundaries: {adminFeaturesStore.fetchError}
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
		{#if filename || uploadedAt}
			<div class="text-base-content/50 text-sm">
				{#if filename}<span class="font-medium">{filename}</span>{/if}
				{#if uploadedAt}
					<span class="ml-2">— processed at {new Date(uploadedAt).toLocaleString()}</span>
				{/if}
			</div>
		{/if}

		<!-- Group-by / value filter controls -->
		{#if metadataCols.length > 0}
			<div class="card bg-white shadow">
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
	{/if}
</div>
