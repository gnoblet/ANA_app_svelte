<script lang="ts">
	import { tileCssClass, tileStyle, PRELIM_BADGE } from '$lib/utils/colors';
	import SortIcon from '$lib/components/ui/SortIcon.svelte';

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
		tooltipX = e.clientX + 12;
		tooltipY = e.clientY + 12;
		tooltipVisible = true;
	}

	function moveTooltip(e: MouseEvent) {
		tooltipX = e.clientX + 12;
		tooltipY = e.clientY + 12;
	}

	function hideTooltip() {
		tooltipVisible = false;
	}

	// ── Sort ─────────────────────────────────────────────────────────────────
	// sortKey: null = no sort, 'uoa' = sort by UOA label, 'prelim' = sort by
	// prelim_flag, or a system id = sort by that system's flag count.
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
	<div
		class="border-base-content/70 pointer-events-none fixed z-50 rounded border bg-white px-3 py-2 text-sm shadow-md"
		style="left:{tooltipX}px; top:{tooltipY}px; max-width:220px;"
	>
		<div class="mb-1 font-semibold">{tooltipSystem}</div>
		<div class="text-base-content">
			<span
				class="mr-1 inline-block h-3 w-3 rounded"
				style="background-color: var(--color-noflag-tint)"
			></span>Available:
			{tooltipAvail}
		</div>
		<div class="text-base-content">
			<span
				class="mr-1 inline-block h-3 w-3 rounded"
				style="background-color: var(--color-no-data-tint)"
			></span>Missing:
			{tooltipMissing}
		</div>
	</div>
{/if}

<div class="card bg-white shadow">
	<div class="card-body">
		<h2 class="card-title">System-level flag counts per UOA</h2>
		<p class="mb-2">
			Each cell shows the number of flagged indicators. Hover for details, click to drill down.
		</p>

		<div class="rounded-box border-base-content/30 overflow-x-auto border bg-white">
			<table class="table-xs table">
				<colgroup>
					<col class="w-36" />
					{#each systems as _sys (_sys.id)}
						<col class="w-24" />
					{/each}
					<col class="w-24" />
				</colgroup>
				<thead>
					<tr class="bg-base-300 text-base-content">
						<th class="select-none">
							<button
								class="hover:text-base-content/80 flex items-center gap-1 font-semibold"
								onclick={() => toggleSort('uoa')}
								aria-label="Sort by UOA"
								>UOA
								<SortIcon active={sortKey === 'uoa'} asc={sortAsc} />
							</button>
						</th>
						{#each systems as sys (sys.id)}
							<th class="text-center leading-tight whitespace-normal select-none">
								<button
									class="hover:text-base-content/80 flex w-full items-center justify-center gap-1 leading-tight font-semibold whitespace-normal"
									onclick={() => toggleSort(sys.id)}
									aria-label="Sort by {sys.label}"
									>{sys.label}
									{#if sortKey === sys.id}
										<svg
											aria-hidden="true"
											class="size-3 shrink-0"
											viewBox="0 0 12 12"
											fill="currentColor"
										>
											{#if sortAsc}<path d="M6 2l4 6H2z" />{:else}<path d="M6 10L2 4h8z" />{/if}
										</svg>
									{:else}
										<svg
											aria-hidden="true"
											class="size-3 shrink-0 opacity-30"
											viewBox="0 0 12 12"
											fill="currentColor"
										>
											<path d="M6 1l3 4H3zM6 11L3 7h6z" />
										</svg>
									{/if}
								</button>
							</th>
						{/each}
						<th class="text-center leading-tight whitespace-normal select-none">
							<button
								class="hover:text-base-content/80 flex items-center gap-1 font-semibold"
								onclick={() => toggleSort('prelim')}
								aria-label="Sort by preliminary flag"
								>Prelim. flag
								<SortIcon active={sortKey === 'prelim'} asc={sortAsc} />
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedRows as row (row.uoa)}
						{@const badge = PRELIM_BADGE[row.prelim_flag]}
						<tr>
							<td class="whitespace-nowrap">{row.uoa}</td>
							{#each systems as sys (sys.id)}
								{@const s = cellStats(row, sys.id)}
								{@const active = activeUoa === String(row.uoa) && activeSystem === sys.id}
								<td class="p-1 text-center">
									<button
										class="w-full rounded px-2 py-2 text-sm font-semibold transition-all {tileCssClass(
											s.flag_n,
											s.avail,
											active
										)}"
										style={tileStyle(s.flag_n, s.avail)}
										onmouseenter={(e) => showTooltip(e, s.avail, s.missing, sys.label)}
										onmousemove={moveTooltip}
										onmouseleave={hideTooltip}
										onclick={() => {
											hideTooltip();
											onselect?.(String(row.uoa), sys.id);
										}}
									>
										{s.avail === 0 ? '–' : s.flag_n}
									</button>
								</td>
							{/each}
							<td class="p-1 text-center">
								{#if badge}
									<span
										class="text-base-content inline-block rounded px-2 py-0.5 text-xs leading-snug font-medium"
										style="background-color: {badge.bg};">{badge.label}</span
									>
								{:else}
									<span class="text-base-content/40 text-xs">–</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="text-base-content/70 mt-2 flex flex-wrap gap-4 text-xs">
			<span class="flex items-center gap-1 font-semibold"> Legend: </span>
			<span class="flex items-center gap-1">
				<span
					class="inline-block h-3 w-3 rounded"
					style="background-color: var(--color-noflag-tint)"
				></span> 0 flags
			</span>
			<span class="flex items-center gap-1">
				<span class="inline-block h-3 w-3 rounded" style="background-color: var(--color-flag-tint)"
				></span> ≥1 flag
			</span>
			<span class="flex items-center gap-1">
				<span
					class="inline-block h-3 w-3 rounded"
					style="background-color: var(--color-no-data-tint)"
				></span> no data
			</span>
			<span class="text-base-content/70 mx-1">|</span>
			{#each Object.entries(PRELIM_BADGE) as [, badge] (badge.label)}
				<span class="flex items-center gap-1">
					<span class="inline-block h-3 w-3 rounded" style="background-color: {badge.bg}"></span>
					{badge.label}
				</span>
			{/each}
		</div>
	</div>
</div>
