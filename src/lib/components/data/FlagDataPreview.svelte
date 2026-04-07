<script lang="ts">
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import PrelimBadge from '$lib/components/ui/PrelimBadge.svelte';

	interface Props {
		rows: Record<string, unknown>[];
	}

	let { rows }: Props = $props();
</script>

<div class="card bg-base-100 border-base-300/40 border shadow-sm">
	<div class="card-body">
		<h2 class="card-title text-base">Data Preview</h2>
		<DataTable {rows} pageSize={10} searchable={true}>
			{#snippet renderCell({ col, value }: { col: string; value: string })}
				{#if col === 'prelim_flag'}
					<PrelimBadge {value} />
				{:else}
					{value}
				{/if}
			{/snippet}
		</DataTable>
	</div>
</div>
