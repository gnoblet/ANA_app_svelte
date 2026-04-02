<script lang="ts">
	import { tileCssClass, tileStyle, PRELIM_FLAG_BADGE, FLAG_BADGE } from '$lib/utils/colors';
	import SortIcon from '$lib/components/ui/SortIcon.svelte';
	import TooltipCard from '$lib/components/ui/TooltipCard.svelte';

	type Row = Record<string, any>;
	type System = { id: string; label: string };

	interface Props {
		rows: Row[];
		systems: System[];
		systemCodes: Map<string, string[]>;
		activeUoa?: string | null;
		activeSystem?: string | null;
		onselect?: (uoa: string, systemId: string) => void;
	}

	let {
		rows,
		systems,
		systemCodes,
		activeUoa = null,
		activeSystem = null,
		onselect
	}: Props = $props();

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

	// ── Tooltip ───────────────────────────────────────────────────────────────
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipAvail = $state(0);
	let tooltipMissing = $state(0);
	let tooltipSystem = $state('');

	function showTooltip(e: MouseEvent, avail: number, missing: number, sysLabel: string) {
		tooltipAvail = avail;
		tooltipMissing = missing;
		tooltipSystem = sysLabel;
		tooltipX = e.clientX;
		tooltipY = e.clientY;
		tooltipVisible = true;
	}

	function moveTooltip(e: MouseEvent) {
		tooltipX = e.clientX;
		tooltipY = e.clientY;
	}

	function hideTooltip() {
		tooltipVisible = false;
	}

	// ── Sort ─────────────────────────────────────────────────────────────────
	let sortKey = $state<string | null>(null);
	let sortAsc = $state(true);

	function toggleSort(key: string) {
		if (sortKey === key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = key;
			sortAsc = true;
		}
	}

	const PRELIM_ORDER: Record<string, number> = {
		EM: 0,
		ROEM: 1,
		ACUTE: 2,
		INSUFFICIENT_EVIDENCE: 3,
		NO_ACUTE_NEEDS: 4
	};

	const sortedRows = $derived.by(() => {
		if (sortKey === null) return rows;
		return [...rows].sort((a, b) => {
			let cmp = 0;
			if (sortKey === 'uoa') {
				cmp = String(a.uoa).localeCompare(String(b.uoa));
			} else if (sortKey === 'prelim') {
				const ao = PRELIM_ORDER[a.prelim_flag] ?? 99;
				const bo = PRELIM_ORDER[b.prelim_flag] ?? 99;
				cmp = ao - bo;
			} else {
				const codes = systemCodes.get(sortKey!) ?? [];
				const flagCount = (row: Row) => codes.filter((c) => row[`${c}_flag`] === true).length;
				cmp = flagCount(a) - flagCount(b);
			}
			return sortAsc ? cmp : -cmp;
		});
	});
</script>

<!-- HTML tooltip (fixed, follows mouse) -->
{#if tooltipVisible}
	<TooltipCard
		title={tooltipSystem}
		x={tooltipX}
		y={tooltipY}
		swatches={[
			{ color: 'var(--color-noflag-tint)', label: `Available: ${tooltipAvail}` },
			{ color: 'var(--color-no-data-tint)', label: `Missing: ${tooltipMissing}` }
		]}
	/>
{/if}

<div class="card bg-white shadow">
	<div class="card-body">
		<h2 class="card-title">System-level flag counts per UOA</h2>
		<p class="text-base-content/60 mb-3 text-sm">
			Each cell shows the number of flagged indicators. Hover for details, click to drill down.
		</p>

		<div class="overflow-x-auto rounded border border-base-content/20 bg-white">
			<table class="table table-xs">
				<colgroup>
					<col class="w-36" />
					{#each systems as _sys (_sys.id)}
						<col class="w-24" />
					{/each}
					<col class="w-28" />
				</colgroup>
				<thead>
					<tr class="bg-base-200 text-base-content">
						<th class="select-none">
							<button
								class="flex items-center gap-1 font-semibold hover:text-base-content/70"
								onclick={() => toggleSort('uoa')}
								aria-label="Sort by UOA"
							>
								UOA
								<SortIcon active={sortKey === 'uoa'} asc={sortAsc} />
							</button>
						</th>
						{#each systems as sys (sys.id)}
							<th class="select-none whitespace-normal text-center leading-tight">
								<button
									class="flex w-full items-center justify-center gap-1 whitespace-normal font-semibold leading-tight hover:text-base-content/70"
									onclick={() => toggleSort(sys.id)}
									aria-label="Sort by {sys.label}"
								>
									{sys.label}
									<SortIcon active={sortKey === sys.id} asc={sortAsc} />
								</button>
							</th>
						{/each}
						<th class="select-none whitespace-normal text-center leading-tight">
							<button
								class="flex items-center gap-1 font-semibold hover:text-base-content/70"
								onclick={() => toggleSort('prelim')}
								aria-label="Sort by preliminary classification"
							>
								Classification
								<SortIcon active={sortKey === 'prelim'} asc={sortAsc} />
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedRows as row (row.uoa)}
						{@const badge = PRELIM_FLAG_BADGE[row.prelim_flag]}
						<tr>
							<td class="whitespace-nowrap">{row.uoa}</td>
							{#each systems as sys (sys.id)}
								{@const s = cellStats(row, sys.id)}
								{@const active = activeUoa === String(row.uoa) && activeSystem === sys.id}
								<td class="p-1 text-center">
									<button
										class="w-full rounded px-2 py-2 text-sm font-semibold transition-all {tileCssClass(s.flag_n, s.avail, active)}"
										style={tileStyle(s.flag_n, s.avail)}
										onmouseenter={(e) => showTooltip(e, s.avail, s.missing, sys.label)}
										onmousemove={moveTooltip}
										onmouseleave={hideTooltip}
										onclick={() => { hideTooltip(); onselect?.(String(row.uoa), sys.id); }}
										aria-label="{s.flag_n} flagged indicator{s.flag_n !== 1 ? 's' : ''} for {sys.label}"
									>
										{s.avail === 0 ? '–' : s.flag_n}
									</button>
								</td>
							{/each}
							<td class="p-1 text-center">
								{#if badge}
									<span
										class="inline-block rounded px-2 py-0.5 text-xs font-medium leading-snug text-base-content"
										style="background-color: {badge.bg};"
									>{badge.label}</span>
								{:else}
									<span class="text-xs text-base-content/40">–</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Legend -->
		<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-base-content/60">
			<span class="font-semibold">Legend:</span>
			{#each ['no_flag', 'flag', 'no_data'] as fk (fk)}
				{@const fb = FLAG_BADGE[fk]}
				<span class="flex items-center gap-1">
					<span class="inline-block h-3 w-3 rounded" style="background-color: var({fb.tintVar})"></span>
					{fb.label}
				</span>
			{/each}
			<span class="text-base-content/30 mx-1">|</span>
			{#each Object.entries(PRELIM_FLAG_BADGE) as [, badge] (badge.label)}
				<span class="flex items-center gap-1">
					<span class="inline-block h-3 w-3 rounded" style="background-color: {badge.bg}"></span>
					{badge.label}
				</span>
			{/each}
		</div>
	</div>
</div>
