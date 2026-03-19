<script lang="ts">
	import { onMount } from 'svelte';
	import CirclePacking from '$lib/components/viz/CirclePacking.svelte';
	let data: any = null;
	let error: string | null = null;
	let loading = true;

	onMount(async () => {
		try {
			const res = await fetch('/data/indicators-circlepacking.json');
			if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
			data = await res.json();
		} catch (e: any) {
			error = e?.message ?? String(e);
		} finally {
			loading = false;
		}
	});
</script>

{#if error}
	<p class="text-red-600">Error loading circle-packing data: {error}</p>
{:else if loading}
	<p>Loading circle-packing data…</p>
{:else}
	<!-- Pass spacing props; tweak these where you mount the component if needed -->
	<CirclePacking {data} nodePadding={4} paddingByDepth={{ 0: 60, 1: 40, 2: 5, 3: 5 }} />
{/if}
