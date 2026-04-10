<script lang="ts">
	import Select from '$lib/components/ui/Select.svelte';
	import LegendBadge from '$lib/components/ui/LegendBadge.svelte';
	import IndicatorStrip from '$lib/components/viz/IndicatorStrip.svelte';

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

	type Option = { value: string; label: string };

	interface Props {
		filteredBlocks: SystemBlock[];
		indSystemOptions: Option[];
		indFactorOptions: Option[];
		indUoaOptions: Option[];
		indSelectedSystems: string[] | null;
		indSelectedFactors: string[] | null;
		indSelectedUoas: string[] | null;
		totalIndicators: number;
		onindsystemschange: (v: string | string[]) => void;
		onindfactorschange: (v: string | string[]) => void;
		oninduoaschange: (v: string | string[]) => void;
	}

	let {
		filteredBlocks,
		indSystemOptions,
		indFactorOptions,
		indUoaOptions,
		indSelectedSystems,
		indSelectedFactors,
		indSelectedUoas,
		totalIndicators,
		onindsystemschange,
		onindfactorschange,
		oninduoaschange
	}: Props = $props();
</script>

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
					onchange={onindsystemschange}
				/>
				<Select
					label="Factors"
					options={indFactorOptions}
					selected={indSelectedFactors ?? indFactorOptions.map((o) => o.value)}
					placeholder="Select factors…"
					onchange={onindfactorschange}
				/>
				<Select
					label="Units of Analysis"
					options={indUoaOptions}
					selected={indSelectedUoas ?? indUoaOptions.map((o) => o.value)}
					placeholder="Select UOAs…"
					onchange={oninduoaschange}
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
													<span class="text-base-content/80 text-xs italic">— {ind.metric}</span>
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
