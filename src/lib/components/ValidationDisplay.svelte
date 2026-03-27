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
			String(e.colIndex != null ? e.colIndex + 1 : e.col ?? ''),
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
		<div class="card bg-base-200 p-4 flex items-center gap-3">
			<span class="loading loading-spinner loading-md text-primary"></span>
			<span class="text-base-content/60">Being processed…</span>
		</div>
	{:else}
		<!-- Summary card -->
			<div class="card bg-white border border-base-content/10 p-4">
			{#if result}
				<div class="flex items-center gap-2 flex-wrap">
					{#if result.ok}
						<span class="badge badge-success">Validation passed</span>
					{:else}
						<span class="badge badge-error">Validation failed</span>
					{/if}
					<span class="text-sm text-base-content/60">
						{numDataRows()} row(s) × {numCols()} column(s)
					</span>
					{#if result.headerErrors?.length}
						<span class="badge badge-error badge-outline">{result.headerErrors.length} header error(s)</span>
					{/if}
					{#if result.cellErrors?.length}
						<span class="badge badge-error badge-outline">{result.cellErrors.length} cell error(s)</span>
					{/if}
					{#if result.warnings?.length}
						<span class="badge badge-warning badge-outline">{result.warnings.length} warning(s)</span>
					{/if}
				</div>
			{:else}
				<span class="text-base-content/50 text-sm">No validation run yet</span>
			{/if}
		</div>

		<!-- Header errors -->
		{#if result?.headerErrors?.length}
			<div>
				<p class="font-semibold text-error mb-1">Header errors</p>
				<ul class="list-disc list-inside text-sm space-y-0.5">
					{#each result.headerErrors as he, i (i)}
						<li>{he}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Duplicate UOAs -->
		{#if result?.duplicateUoas?.length}
			<div>
				<p class="font-semibold text-error mb-1">Duplicate UOA values</p>
				<ul class="list-disc list-inside text-sm space-y-0.5">
					{#each result.duplicateUoas as d, i (i)}
						<li><strong>{d.uoa}</strong> — rows: {Array.isArray(d.rows) ? d.rows.join(', ') : d.rows}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Cell errors table -->
		{#if result?.cellErrors?.length}
			<div>
				<p class="font-semibold text-error mb-1">Cell errors ({result.cellErrors.length})</p>
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
				<p class="font-semibold text-warning mb-1">Missingness by indicator</p>
				<DataTable
					columns={missingnessColumns}
					data={missingnessData}
					headerRowClass="bg-warning/10 text-warning"
					pageSize={10}
				/>
			</div>
		{/if}

		<!-- Warnings -->
		{#if result?.warnings?.length}
			<div>
				<p class="font-semibold text-warning mb-1">Warnings ({result.warnings.length})</p>
				<ul class="list-disc list-inside text-sm space-y-0.5">
					{#each result.warnings as w, i (i)}
						<li>{w}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- CSV preview -->
		<div>
			<p class="text-sm font-semibold mb-1">
				CSV preview (first {Math.min(10, numDataRows())} row(s))
			</p>
			{#if header?.length}
				<DataTable columns={header} data={previewData} />
			{:else}
				<span class="text-base-content/50 text-sm">No header to preview</span>
			{/if}
		</div>
	{/if}
</div>

