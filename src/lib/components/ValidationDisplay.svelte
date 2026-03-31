<script lang="ts">
	import DataTable from '$lib/components/ui/DataTable.svelte';

	let { result = null, header = [], rows = [], loading = false } = $props();

	const numDataRows = () => (rows && Array.isArray(rows) ? rows.length : 0);
	const numCols = () => (header && Array.isArray(header) ? header.length : 0);

	const formatCell = (v: unknown) => (v === null || v === undefined ? '' : String(v));

	// --- cell errors table data ---
	const cellErrorColumns = ['Row', 'Col', 'Column', 'Value', 'Message'];
	const cellErrorData = $derived(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		result?.cellErrors?.map((e: any) => [
			String(e.row ?? ''),
			String(e.colIndex != null ? e.colIndex + 1 : (e.col ?? '')),
			String(e.colName ?? ''),
			formatCell(e.value),
			String(e.message ?? '')
		]) ?? []
	);

	// --- missingness table data ---
	const missingnessColumns = ['Indicator', 'Missing', 'Total', 'Percent'];
	const missingnessData = $derived.by(() => {
		if (!result?.missingnessMap) return [];
		const rows = [];
		for (const indicator in result.missingnessMap) {
			if (Object.prototype.hasOwnProperty.call(result.missingnessMap, indicator)) {
				const stats = result.missingnessMap[indicator];
				if (stats.missing > 0) {
					rows.push([
						indicator,
						String(stats.missing),
						String(stats.total),
						Math.round((stats.missing / stats.total) * 100) + '%'
					]);
				}
			}
		}
		return rows.sort((a, b) => parseFloat(b[3]) - parseFloat(a[3]));
	});

	// --- preview table data ---
	const previewData = $derived(
		rows && Array.isArray(rows) ? rows.slice(0, 10).map((row) => row.map(formatCell)) : []
	);
</script>

<div class="flex flex-col gap-4">
	{#if loading}
		<div class="card flex items-center gap-3 p-4">
			<span class="loading loading-spinner loading-md text-primary"></span>
			<span class="text-base-content/60">Being processed…</span>
		</div>
	{:else}
		<!-- Summary card -->
		<div class="card border p-4">
			{#if result}
				<div class="flex flex-wrap items-center gap-2">
					{#if result.ok}
						<span class="badge badge-success">Validation passed</span>
					{:else}
						<span class="badge badge-error">Validation failed</span>
					{/if}
					<span class="text-base-content/60 text-sm">
						{numDataRows()} row(s) × {numCols()} column(s)
					</span>
					{#if result.headerErrors?.length}
						<span class="badge badge-error badge-outline"
							>{result.headerErrors.length} header error(s)</span
						>
					{/if}
					{#if result.cellErrors?.length}
						<span class="badge badge-error badge-outline"
							>{result.cellErrors.length} cell error(s)</span
						>
					{/if}
					{#if result.warnings?.length}
						<span class="badge badge-warning badge-outline"
							>{result.warnings.length} warning(s)</span
						>
					{/if}
				</div>
			{:else}
				<span class="text-base-content/80 text-sm">No validation run yet</span>
			{/if}
		</div>

		<!-- Header errors -->
		{#if result?.headerErrors?.length}
			<div>
				<p class="text-error mb-1 font-semibold">Header errors</p>
				<ul class="list-inside list-disc space-y-0.5 text-sm">
					{#each result.headerErrors as he, i (i)}
						<li>{he}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Duplicate UOAs -->
		{#if result?.duplicateUoas?.length}
			<div>
				<p class="text-error mb-1 font-semibold">Duplicate UOA values</p>
				<ul class="list-inside list-disc space-y-0.5 text-sm">
					{#each result.duplicateUoas as d, i (i)}
						<li>
							<strong>{d.uoa}</strong> — rows: {Array.isArray(d.rows) ? d.rows.join(', ') : d.rows}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Cell errors table -->
		{#if result?.cellErrors?.length}
			<div>
				<p class="text-error mb-1 font-semibold">Cell errors ({result.cellErrors.length})</p>
				<DataTable
					columns={cellErrorColumns}
					data={cellErrorData}
					headerRowClass="bg-error/10 text-error"
					pageSize={10}
				/>
			</div>
		{/if}

		<!-- Missingness table -->
		{#if missingnessData.length > 0}
			<div>
				<p class="text-warning mb-1 font-semibold">Missingness by indicator</p>
				<DataTable
					columns={missingnessColumns}
					data={missingnessData}
					headerRowClass="bg-warning text-warning-content"
					pageSize={10}
				/>
			</div>
		{/if}

		<!-- Warnings -->
		{#if result?.warnings?.length}
			<div>
				<p class="text-warning mb-1 font-semibold">Warnings ({result.warnings.length})</p>
				<ul class="list-inside list-disc space-y-0.5 text-sm">
					{#each result.warnings as w, i (i)}
						<li>{w}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- CSV preview -->
		<div>
			{#if header?.length}
				<p class="mb-1 text-sm font-semibold">
					CSV preview: first {Math.min(10, numDataRows())} row(s)
				</p>
				<DataTable columns={header} data={previewData} />
			{/if}
		</div>
	{/if}
</div>
