<script lang="ts">
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
		/** Rows per page. Set to 0 to disable pagination. Default 0 = show all. */
		pageSize?: number;
	}

	let {
		columns = [],
		data = [],
		tableClass = 'table-sm',
		headerRowClass = '',
		rowClass = 'even:bg-white hover:bg-base-200',
		pageSize = 0
	}: Props = $props();

	let page = $state(0);

	const pageCount = $derived(pageSize > 0 ? Math.ceil(data.length / pageSize) : 1);
	const pageRows = $derived(
		pageSize > 0 ? data.slice(page * pageSize, (page + 1) * pageSize) : data
	);

	// Reset to first page whenever data changes
	$effect(() => {
		void data;
		page = 0;
	});
</script>

<div class="flex flex-col gap-2">
	<div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
		<table class="table {tableClass}">
			<thead>
				<tr class={headerRowClass}>
					{#each columns as col (col)}
						<th>{col}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each pageRows as row, i (i)}
					<tr class={rowClass}>
						{#each row as cell, j (j)}
							<td>{cell}</td>
						{/each}
					</tr>
				{:else}
					<tr>
						<td colspan={columns.length} class="text-center text-base-content/50 py-4">
							No data.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if pageSize > 0 && pageCount > 1}
		<div class="flex items-center justify-between text-sm text-base-content/60">
			<span>{data.length} row(s) — page {page + 1} of {pageCount}</span>
			<div class="join">
				<button class="join-item btn btn-xs" disabled={page === 0} onclick={() => (page = 0)}
					>«</button
				>
				<button
					class="join-item btn btn-xs"
					disabled={page === 0}
					onclick={() => (page = page - 1)}>‹</button
				>
				<button
					class="join-item btn btn-xs"
					disabled={page >= pageCount - 1}
					onclick={() => (page = page + 1)}>›</button
				>
				<button
					class="join-item btn btn-xs"
					disabled={page >= pageCount - 1}
					onclick={() => (page = pageCount - 1)}>»</button
				>
			</div>
		</div>
	{/if}
</div>
