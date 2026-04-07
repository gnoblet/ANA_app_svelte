<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import NoDataState from './NoDataState.svelte';
	import { appReady } from '$lib/stores/appReady.svelte';

	interface Props {
		hasData: boolean;
		/** Message shown in the loading spinner while waiting for client hydration. */
		loadingMessage?: string;
		children: Snippet;
	}

	let { hasData, children, loadingMessage = 'Looking for stored data…' }: Props = $props();
</script>

{#if !appReady}
	<div class="flex flex-col items-center justify-center gap-3 py-16" out:fade={{ duration: 400 }}>
		<span class="loading loading-spinner loading-xl"></span>
		<p class="text-3xl">{loadingMessage}</p>
	</div>
{:else if !hasData}
	<div in:fly={{ y: 6, duration: 300, easing: quintOut }}>
		<NoDataState />
	</div>
{:else}
	<div in:fly={{ y: 6, duration: 300, easing: quintOut }}>
		{@render children()}
	</div>
{/if}
