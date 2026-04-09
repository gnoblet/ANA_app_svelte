<script lang="ts">
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import PrelimBadge from '$lib/components/ui/PrelimBadge.svelte';

	interface Props {
		rows: Record<string, unknown>[];
	}

	let { rows }: Props = $props();
</script>
