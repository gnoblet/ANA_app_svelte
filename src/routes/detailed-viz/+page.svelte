<script lang="ts">
	import { onMount } from 'svelte';
	import { flagStore } from '$lib/stores/flagStore.svelte';
	import { indicatorsStore, loadIndicatorsIntoStore } from '$lib/stores/indicatorsStore.svelte';
	import { resolve } from '$app/paths';
	import Chevron from '$lib/components/ui/Chevron.svelte';
	import IndicatorStrip from '$lib/components/viz/IndicatorStrip.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import {
		getIndicatorMetadata,
		getFactorMetadata,
		getSystemMetadata,
		buildSubfactorList
	} from '$lib/access/access_indicators.js';

	type AnyMd = Record<string, unknown> & { raw?: Record<string, unknown> };

	onMount(() => {
		loadIndicatorsIntoStore();
	});

	type Row = Record<string, any>;

	const flagged = $derived(flagStore.flaggedResult ?? ([] as Row[]));
	const indicatorsJson = $derived(indicatorsStore.indicatorsJson);
	const hasData = $derived(flagged.length > 0 && indicatorsJson !== null);

	// ── Interfaces ────────────────────────────────────────────────────────────

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

	// ── Build all blocks from raw data ────────────────────────────────────────

	function buildSystemBlocks(rows: Row[], json: Record<string, unknown>): SystemBlock[] {
		const subList = buildSubfactorList(json) ?? [];
		const blocks: SystemBlock[] = [];

		const systemIds: string[] = [];
		for (const { path } of subList) {
			const sysId = String(path).split('.')[0];
			if (!systemIds.includes(sysId)) systemIds.push(sysId);
		}

		for (const systemId of systemIds) {
			const sysMd = getSystemMetadata(json, systemId) as AnyMd | null;
			const systemLabel: string =
				(sysMd?.system_label as string) ?? (sysMd?.raw?.label as string) ?? systemId;

			const factorIds: string[] = [];
			for (const { path } of subList) {
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
				for (const { path, codes } of subList) {
					const parts = String(path).split('.');
					if (parts[0] !== systemId || parts[1] !== factorId) continue;
					for (const c of codes) {
						if (!indicatorIds.includes(c)) indicatorIds.push(c);
					}
				}

				const indicatorBlocks: IndicatorBlock[] = [];

				for (const indId of indicatorIds) {
					const dots = rows
						.map((row: Row) => {
							const value = row[indId];
							const flagLabel: string = String(row[`${indId}_flag_label`] ?? 'no_data');
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

	// All blocks, unfiltered
	const allBlocks = $derived(
		hasData && indicatorsJson
			? buildSystemBlocks(flagged, indicatorsJson as Record<string, unknown>)
			: ([] as SystemBlock[])
	);

	// ── Filter options derived from allBlocks ─────────────────────────────────

	const systemOptions = $derived(
		allBlocks.map((s) => ({ value: s.systemId, label: s.systemLabel }))
	);

	const factorOptions = $derived(
		allBlocks.flatMap((s) => s.factors.map((f) => ({ value: f.factorId, label: f.factorLabel })))
	);

	const uoaOptions = $derived(
		Array.from(
			new Map(
				flagged.map((r: Row) => [String(r.uoa), { value: String(r.uoa), label: String(r.uoa) }])
			).values()
		).sort((a, b) => a.label.localeCompare(b.label))
	);

	// ── Filter selections — track deselected values, not selected ────────────
	// Storing *deselected* values means the default is "all selected" with no
	// initialisation needed. Each deselected set is clamped to the current option
	// list via $derived so stale values auto-clear when options change.

	let _deselectedSystems = $state<Set<string>>(new Set());
	let _deselectedFactors = $state<Set<string>>(new Set());
	let _deselectedUoas = $state<Set<string>>(new Set());

	// Clamp: only keep deselected values that still exist in current options.
	const deselectedSystems = $derived(
		new Set(systemOptions.map((o) => o.value).filter((v) => _deselectedSystems.has(v)))
	);
	const deselectedFactors = $derived(
		new Set(factorOptions.map((o) => o.value).filter((v) => _deselectedFactors.has(v)))
	);
	const deselectedUoas = $derived(
		new Set(uoaOptions.map((o) => o.value).filter((v) => _deselectedUoas.has(v)))
	);

	// What Select receives as "selected" = all current options minus deselected.
	const selectedSystems = $derived(
		systemOptions.map((o) => o.value).filter((v) => !deselectedSystems.has(v))
	);
	const selectedFactors = $derived(
		factorOptions.map((o) => o.value).filter((v) => !deselectedFactors.has(v))
	);
	const selectedUoas = $derived(
		uoaOptions.map((o) => o.value).filter((v) => !deselectedUoas.has(v))
	);

	// When Select calls onchange, store the new deselected set from what was removed.
	function onSystemsChange(next: string | string[]) {
		const nextSet = new Set(Array.isArray(next) ? next : [next]);
		_deselectedSystems = new Set(systemOptions.map((o) => o.value).filter((v) => !nextSet.has(v)));
	}
	function onFactorsChange(next: string | string[]) {
		const nextSet = new Set(Array.isArray(next) ? next : [next]);
		_deselectedFactors = new Set(factorOptions.map((o) => o.value).filter((v) => !nextSet.has(v)));
	}
	function onUoasChange(next: string | string[]) {
		const nextSet = new Set(Array.isArray(next) ? next : [next]);
		_deselectedUoas = new Set(uoaOptions.map((o) => o.value).filter((v) => !nextSet.has(v)));
	}

	// ── Filtered blocks ───────────────────────────────────────────────────────

	const filteredBlocks = $derived(
		allBlocks
			.filter((s) => selectedSystems.includes(s.systemId))
			.map((s) => ({
				...s,
				factors: s.factors
					.filter((f) => selectedFactors.includes(f.factorId))
					.map((f) => ({
						...f,
						indicators: f.indicators
							.map((ind) => ({
								...ind,
								dots: ind.dots.filter((d) => selectedUoas.includes(d.uoa))
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
</script>

<div class="min-h-screen space-y-8 p-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">Detailed Results</h1>
		<a href={resolve('/viz')} class="btn btn-outline btn-sm"><Chevron variant="left" /> Overview</a>
	</div>

	{#if !hasData}
		<div class="alert alert-warning">
			<span>No flagged data found.</span>
			<a href={resolve('/')} class="btn btn-primary btn-sm ml-4">Go back and validate data</a>
		</div>
	{:else}
		<!-- Filters -->
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body py-4">
				<h2 class="card-title text-base">Filters</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div class="relative">
						<Select
							label="Systems"
							options={systemOptions}
							selected={selectedSystems}
							placeholder="Select systems…"
							onchange={onSystemsChange}
						/>
					</div>
					<div class="relative">
						<Select
							label="Factors"
							options={factorOptions}
							selected={selectedFactors}
							placeholder="Select factors…"
							onchange={onFactorsChange}
						/>
					</div>
					<div class="relative">
						<Select
							label="Units of Analysis"
							options={uoaOptions}
							selected={selectedUoas}
							placeholder="Select UOAs…"
							onchange={onUoasChange}
						/>
					</div>
				</div>
				<p class="mt-2 text-xs text-gray-400">
					Showing {totalIndicators} indicator{totalIndicators !== 1 ? 's' : ''}
					across {filteredBlocks.length} system{filteredBlocks.length !== 1 ? 's' : ''}
					for {selectedUoas.length} UOA{selectedUoas.length !== 1 ? 's' : ''}
				</p>
			</div>
		</div>

		<!-- Legend -->
		<div class="flex flex-wrap items-center gap-4 text-sm text-gray-600">
			<span class="font-semibold">Legend:</span>
			<span class="flex items-center gap-1.5">
				<span class="bg-flag inline-block h-3 w-3 rounded-full"></span> Flagged
			</span>
			<span class="flex items-center gap-1.5">
				<span class="bg-noflag inline-block h-3 w-3 rounded-full"></span> OK
			</span>
			<span class="flex items-center gap-1.5">
				<span class="bg-noflag ring-within10 inline-block h-3 w-3 rounded-full ring-2 ring-offset-1"
				></span>
				OK but within 10% of threshold
			</span>
			<span class="flex items-center gap-1.5">
				<span class="h-4 border-l-2 border-dashed border-orange-400"></span>
				<span class="font-mono text-xs text-orange-500">AN</span> threshold
			</span>
		</div>

		<!-- No results after filtering -->
		{#if filteredBlocks.length === 0}
			<div class="alert alert-info">
				<span
					>No indicators match the current filters. Try selecting more systems, factors, or UOAs.</span
				>
			</div>
		{:else}
			<!-- System blocks -->
			{#each filteredBlocks as sys (sys.systemId)}
				<section>
					<h2 class="mb-4 border-b-2 border-gray-300 pb-2 text-2xl font-bold">
						{sys.systemLabel}
					</h2>

					<div class="space-y-8">
						{#each sys.factors as fac (fac.factorId)}
							<div>
								<h3 class="mb-3 text-lg font-semibold text-gray-700">{fac.factorLabel}</h3>

								<div class="space-y-2">
									{#each fac.indicators as ind (ind.id)}
										<div
											class="rounded-lg border border-gray-100 bg-white px-4 pt-3 pb-1 shadow-sm"
										>
											<div class="mb-1 flex flex-wrap items-baseline gap-2">
												<span class="text-sm font-semibold text-gray-800">{ind.label}</span>
												<span class="font-mono text-xs text-gray-400">{ind.id}</span>
												{#if ind.metric}
													<span class="text-xs text-gray-500 italic">— {ind.metric}</span>
												{/if}
												<span class="ml-auto text-xs text-gray-400">
													{ind.dots.length} UOA{ind.dots.length !== 1 ? 's' : ''}
												</span>
											</div>
											<IndicatorStrip
												indicatorLabel={ind.label}
												threshold={ind.threshold}
												direction={ind.direction}
												dots={ind.dots}
												height={80}
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
	{/if}
</div>
