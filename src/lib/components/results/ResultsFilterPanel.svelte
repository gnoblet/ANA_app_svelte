<script lang="ts">
	import Select from '$lib/components/ui/Select.svelte';
	import ButtonClear from '$lib/components/ui/ButtonClear.svelte';
	import { FLAG_BADGE } from '$lib/utils/colors';

	type Option = { value: string; label: string };

	interface Props {
		// totals
		totalCount: number;
		filteredCount: number;
		isFiltered: boolean;
		// overview / global filters
		overviewUoaOptions: Option[];
		overviewSelectedUoas: string[] | null;
		selectedPrelimKeys: string[] | null;
		PRELIM_KEYS: string[];
		prelimOptions: Option[];
		metadataCols: string[];
		groupByCol: string | null;
		groupByOptions: Option[];
		selectedGroupValues: string[];
		// indicators-specific filters
		indSystemOptions: Option[];
		indFactorOptions: Option[];
		indUoaOptions: Option[];
		indSelectedSystems: string[] | null;
		indSelectedFactors: string[] | null;
		indSelectedUoas: string[] | null;
		// callbacks
		onoverviewuoaschange: (v: string | string[]) => void;
		onprelimkeyschange: (v: string | string[]) => void;
		ongroupbycol: (v: string | null) => void;
		ongroupvalueschange: (v: string | string[]) => void;
		onindsystemschange: (v: string | string[]) => void;
		onindfactorschange: (v: string | string[]) => void;
		oninduoaschange: (v: string | string[]) => void;
		// coverage
		coverageUoaOptions: string[];
		coverageUoa: string;
		oncoverageUoaChange: (v: string) => void;
		// drilldown (systems section)
		drillPrefFilter: number[];
		drillFlagFilter: string[];
		ontoggledrillpref: (p: number) => void;
		ontoggledrillFlag: (f: string) => void;
		onclearfilters: () => void;
	}

	let {
		totalCount,
		filteredCount,
		isFiltered,
		overviewUoaOptions,
		overviewSelectedUoas,
		selectedPrelimKeys,
		PRELIM_KEYS,
		prelimOptions,
		metadataCols,
		groupByCol,
		groupByOptions,
		selectedGroupValues,
		indSystemOptions,
		indFactorOptions,
		indUoaOptions,
		indSelectedSystems,
		indSelectedFactors,
		indSelectedUoas,
		onoverviewuoaschange,
		onprelimkeyschange,
		ongroupbycol,
		ongroupvalueschange,
		onindsystemschange,
		onindfactorschange,
		oninduoaschange,
		coverageUoaOptions,
		coverageUoa,
		oncoverageUoaChange,
		drillPrefFilter,
		drillFlagFilter,
		ontoggledrillpref,
		ontoggledrillFlag,
		onclearfilters
	}: Props = $props();

	const DRILL_FLAG_OPTIONS = [
		{ key: 'flag',    label: FLAG_BADGE['flag'].label,    cls: FLAG_BADGE['flag'].checkboxCls    },
		{ key: 'no_flag', label: FLAG_BADGE['no_flag'].label, cls: FLAG_BADGE['no_flag'].checkboxCls },
		{ key: 'no_data', label: FLAG_BADGE['no_data'].label, cls: FLAG_BADGE['no_data'].checkboxCls }
	];
</script>

<div class="bg-base-100 border-base-300 rounded-box border shadow-sm">
	<div class="border-base-300 flex items-center justify-between border-b px-4 py-3">
		<span class="text-sm font-semibold">Filters</span>
		{#if isFiltered}
			<div class="flex items-center gap-2">
				<span class="text-base-content/50 text-xs">
					<strong>{filteredCount}</strong> / {totalCount} UOAs
				</span>
				<ButtonClear label="Clear" onclick={onclearfilters} />
			</div>
		{/if}
	</div>

	<div class="space-y-5 px-4 py-4">
		<!-- Global: UOA + Classification -->
		<div class="space-y-3">
			<p class="text-base-content/50 text-xs font-semibold tracking-wider uppercase">All sections</p>
			<Select
				label="Units of analysis"
				options={overviewUoaOptions}
				selected={overviewSelectedUoas ?? overviewUoaOptions.map((o) => o.value)}
				placeholder="All UOAs"
				onchange={onoverviewuoaschange}
			/>
			<Select
				label="Classification"
				options={prelimOptions}
				selected={selectedPrelimKeys ?? PRELIM_KEYS}
				placeholder="All classifications"
				onchange={onprelimkeyschange}
			/>
			{#if metadataCols.length > 0}
				<Select
					label="Filter by column"
					selected={groupByCol ?? ''}
					placeholder="(no extra filter)"
					options={metadataCols.map((c) => ({ value: c, label: c }))}
					onchange={(v) => ongroupbycol((Array.isArray(v) ? v[0] : v) || null)}
				/>
				{#if groupByCol !== null && groupByOptions.length > 0}
					<Select
						label="Filter values"
						options={groupByOptions}
						selected={selectedGroupValues}
						placeholder="Select values…"
						onchange={ongroupvalueschange}
					/>
				{/if}
			{/if}
		</div>

		<div class="border-base-200 border-t"></div>

		<!-- Indicators-specific -->
		<div class="space-y-3">
			<p class="text-base-content/50 text-xs font-semibold tracking-wider uppercase">Indicators</p>
			<Select
				label="Systems"
				options={indSystemOptions}
				selected={indSelectedSystems ?? indSystemOptions.map((o) => o.value)}
				placeholder="All systems"
				onchange={onindsystemschange}
			/>
			<Select
				label="Factors"
				options={indFactorOptions}
				selected={indSelectedFactors ?? indFactorOptions.map((o) => o.value)}
				placeholder="All factors"
				onchange={onindfactorschange}
			/>
			<Select
				label="Units of analysis"
				options={indUoaOptions}
				selected={indSelectedUoas ?? indUoaOptions.map((o) => o.value)}
				placeholder="All UOAs"
				onchange={oninduoaschange}
			/>
		</div>

		<div class="border-base-200 border-t"></div>

		<!-- Coverage -->
		<div class="space-y-3">
			<p class="text-base-content/50 text-xs font-semibold tracking-wider uppercase">Coverage</p>
			<Select
				label="Unit of analysis"
				options={coverageUoaOptions.map((uoa) => ({ value: uoa, label: uoa }))}
				selected={coverageUoa}
				placeholder="Select UOA…"
				onchange={(val) => oncoverageUoaChange(Array.isArray(val) ? (val[0] ?? '') : val)}
			/>
		</div>

		<div class="border-base-200 border-t"></div>

		<!-- Drilldown (Systems section) -->
		<div class="space-y-3">
			<p class="text-base-content/50 text-xs font-semibold tracking-wider uppercase">Drilldown</p>
			<div>
				<p class="text-base-content/60 mb-1.5 text-xs">Preference</p>
				<div class="flex flex-wrap gap-2">
					{#each [1, 2, 3] as p (p)}
						<label class="flex cursor-pointer items-center gap-1.5">
							<input
								type="checkbox"
								class="checkbox checkbox-xs checkbox-neutral"
								checked={drillPrefFilter.includes(p)}
								onchange={() => ontoggledrillpref(p)}
							/>
							<span class="text-xs">{p}</span>
						</label>
					{/each}
				</div>
			</div>
			<div>
				<p class="text-base-content/60 mb-1.5 text-xs">Status</p>
				<div class="flex flex-col gap-1.5">
					{#each DRILL_FLAG_OPTIONS as opt (opt.key)}
						<label class="flex cursor-pointer items-center gap-1.5">
							<input
								type="checkbox"
								class="checkbox checkbox-xs {opt.cls}"
								checked={drillFlagFilter.includes(opt.key)}
								onchange={() => ontoggledrillFlag(opt.key)}
							/>
							<span class="text-xs">{opt.label}</span>
						</label>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
