<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import NoDataState from './NoDataState.svelte';

	interface Props {
		hasData: boolean;
		/** Message shown in the loading spinner while waiting for client hydration. */
		loadingMessage?: string;
		children: Snippet;
	}

	let {
		hasData,
		children,
		loadingMessage = 'Looking for stored data…'
	}: Props = $props();

	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
</script>

{#if !mounted}
	<div
		class="flex flex-col items-center justify-center gap-3 py-16"
		out:fade={{ duration: 150 }}
	>
		<span class="loading loading-spinner loading-lg text-primary"></span>
		<p class="text-base-content/50 text-sm">{loadingMessage}</p>
	</div>
{:else if !hasData}
	<div in:fade={{ duration: 200 }}>
		<NoDataState />
	</div>
{:else}
	<div in:fade={{ duration: 200 }}>
		{@render children()}
	</div>
{/if}
