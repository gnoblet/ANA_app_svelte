<script lang="ts">
	import type { Snippet } from 'svelte';
	import Chevron from '$lib/components/ui/Chevron.svelte';
	import Search from '$lib/components/ui/Search.svelte';

	interface Props {
		/** Column header labels */
		columns?: string[];
		/** Row data — each row is an array of string values aligned to columns */
		data?: string[][];
		/** Extra classes on the <table> element, e.g. "table-zebra table-sm" */
		tableClass?: string;
		/** Tailwind classes on the <thead> <tr>, e.g. "bg-error/10 text-error" */
		headerRowClass?: string;
		/** Tailwind classes on every <tbody> <tr>, e.g. "hover:bg-base-200" */
		rowClass?: string;
		/** Alternate row background (zebra stripe). Default false = no stripe. */
		stripe?: boolean;
		/** Rows per page. Set to 0 to disable pagination. Default 0 = show all. */
		pageSize?: number;
		/** Row count threshold above which pagination activates automatically.
		 *  Ignored when pageSize is already set explicitly to > 0. */
		maxRows?: number;
		/** Optional custom cell renderer. Receives col name, string value, and indices. */
		renderCell?: Snippet<[{ col: string; value: string; colIndex: number; rowIndex: number }]>;
		/**
		 * Per-column display options keyed by column name.
		 * - wrap: true  → text wraps (white-space: normal), column is fixed by maxWidth
		 * - wrap: false → text does not wrap, column width fits content (default)
		 * - extraClass: additional Tailwind classes, e.g. "max-w-48" or "min-w-24"
		 */
		colOptions?: Record<string, { wrap?: boolean; extraClass?: string }>;
		/** Show a search input above the table. Default false. */
		searchable?: boolean;
		/** Placeholder text for the search input. */
		searchPlaceholder?: string;
	}

	let {
		columns = [],
		data = [],
		tableClass = 'table-sm',
		headerRowClass = 'bg-base-300 text-base-content',
		rowClass = 'hover:bg-base-200',
		stripe = false,
		pageSize = 0,
		maxRows = 0,
		renderCell,
		colOptions = {},
		searchable = false,
		searchPlaceholder = 'Search…'
	}: Props = $props();

	function colClass(colName: string): string {
		const opt = colOptions?.[colName];
		const base = opt?.wrap ? 'whitespace-normal break-words' : 'whitespace-nowrap';
		return opt?.extraClass ? `${base} ${opt.extraClass}` : base;
	}

	// ── Search ────────────────────────────────────────────────────────────────
	let searchQuery = $state('');

	const filteredData = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return data;
		return data.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
	});

	// ── Sort ──────────────────────────────────────────────────────────────────
	let sortCol = $state<number | null>(null);
	let sortAsc = $state(true);

	function toggleSort(colIndex: number) {
		if (sortCol === colIndex) {
			sortAsc = !sortAsc;
		} else {
			sortCol = colIndex;
			sortAsc = true;
		}
		page = 0;
	}

	const sortedData = $derived.by(() => {
		if (sortCol === null) return filteredData;
		return [...filteredData].sort((a, b) => {
			const av = a[sortCol!] ?? '';
			const bv = b[sortCol!] ?? '';
			// numeric sort if both values are numeric strings
			const an = Number(av);
			const bn = Number(bv);
			const cmp = !Number.isNaN(an) && !Number.isNaN(bn) ? an - bn : av.localeCompare(bv);
			return sortAsc ? cmp : -cmp;
		});
	});

	// ── Pagination ────────────────────────────────────────────────────────────
	let page = $state(0);

	// Reset to first page whenever data or search changes
	$effect(() => {
		void filteredData;
		page = 0;
	});

	const effectivePageSize = $derived(
		pageSize > 0 ? pageSize : maxRows > 0 && sortedData.length > maxRows ? maxRows : 0
	);

	const pageCount = $derived(
		effectivePageSize > 0 ? Math.ceil(sortedData.length / effectivePageSize) : 1
	);
	const pageRows = $derived(
		effectivePageSize > 0
			? sortedData.slice(page * effectivePageSize, (page + 1) * effectivePageSize)
			: sortedData
	);
</script>

<div class="flex flex-col gap-2">
	{#if searchable}
		<Search bind:value={searchQuery} placeholder={searchPlaceholder} />
	{/if}

	<div class="overflow-x-auto rounded-box border border-base-content/30 bg-base-100">
		<table class="table {tableClass}">
			<thead>
				<tr class={headerRowClass}>
					{#each columns as col, j (col)}
						<th class="{colClass(col)} select-none">
							<button
								class="flex items-center gap-1 font-semibold hover:text-base-content/80"
								onclick={() => toggleSort(j)}
								aria-label="Sort by {col}"
							>
								{col}
								{#if sortCol === j}
									<!-- active sort: solid arrow -->
									<svg aria-hidden="true" class="size-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
										{#if sortAsc}
											<path d="M6 2l4 6H2z"/>
										{:else}
											<path d="M6 10L2 4h8z"/>
										{/if}
									</svg>
								{:else}
									<!-- inactive: faint up+down arrows -->
									<svg aria-hidden="true" class="size-3 shrink-0 opacity-30" viewBox="0 0 12 12" fill="currentColor">
										<path d="M6 1l3 4H3zM6 11L3 7h6z"/>
									</svg>
								{/if}
							</button>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each pageRows as row, i (i)}
					<tr class="{rowClass}{stripe && i % 2 === 0 ? ' bg-base-200' : ' bg-white'}">
						{#each row as cell, j (j)}
						<td class={colClass(columns[j] ?? '')}>
								{#if renderCell}
									{@render renderCell({ col: columns[j] ?? '', value: cell, colIndex: j, rowIndex: i })}
								{:else}
									{cell}
								{/if}
							</td>
						{/each}
					</tr>
				{:else}
					<tr>
						<td colspan={columns.length} class="text-center py-4">
							No data{searchQuery ? ' matching your search' : ''}.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if effectivePageSize > 0 && pageCount > 1}
		<div class="flex items-center justify-between text-sm">
			<span>{sortedData.length} row(s) — page {page + 1} of {pageCount}</span>
			<div class="join">
				<button aria-label="First page" class="join-item btn btn-primary btn-soft btn-sm" disabled={page === 0} onclick={() => (page = 0)}>
					<Chevron variant="double-left" />
					First
				</button>
				<button aria-label="Previous page" class="join-item btn btn-primary btn-soft btn-sm" disabled={page === 0} onclick={() => (page = page - 1)}>
					<Chevron variant="left" />
					Prev
				</button>
				<button aria-label="Next page" class="join-item btn btn-primary btn-soft btn-sm" disabled={page >= pageCount - 1} onclick={() => (page = page + 1)}>
					Next
					<Chevron variant="right" />
				</button>
				<button aria-label="Last page" class="join-item btn btn-primary btn-soft btn-sm" disabled={page >= pageCount - 1} onclick={() => (page = pageCount - 1)}>
					Last
					<Chevron variant="double-right" />
				</button>
			</div>
		</div>
	{/if}
</div>
