<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import NoDataState from './NoDataState.svelte';
	import { appReady, setAppReady } from '$lib/stores/appReady.svelte';

	interface Props {
		hasData: boolean;
		/**
		 * Controls what is shown while waiting for client hydration:
		 * - `'spinner'` (default) — animated spinner with a loading message
		 * - `'none'` — nothing is rendered; content simply fades/flies in once ready
		 */
		variant?: 'spinner' | 'none';
		/** Message shown in the loading spinner. Only used when `variant` is `'spinner'`. */
		loadingMessage?: string;
		/**
		 * Minimum time (ms) the loading state is shown on the very first guarded-page visit.
		 * Subsequent navigations skip it entirely because `appReady` stays true.
		 * Defaults to 400ms — enough to read the loading message.
		 */
		minLoadingMs?: number;
		children: Snippet;
	}

	let {
		hasData,
		children,
		variant = 'spinner',
		loadingMessage = 'Checking for stored data…',
		minLoadingMs = 400
	}: Props = $props();

	onMount(() => {
		// Wait at least minLoadingMs before revealing content so the loading message
		// is readable. appReady is module-level state — it stays true for the rest of
		// the session, so the delay only applies on the very first guarded-page visit.
		const id = setTimeout(setAppReady, minLoadingMs);
		return () => clearTimeout(id);
	});
</script>

{#if !appReady.ready}
	{#if variant === 'spinner'}
		<div
			class="flex flex-col items-center justify-center gap-4 py-20"
			out:fade={{ duration: 250, easing: quintOut }}
		>
			<div class="relative flex items-center justify-center">
				<span class="loading loading-spinner loading-md text-primary"></span>
			</div>
			<div class="flex flex-col items-center gap-1 text-center">
				<p class="text-base-content/70 text-sm font-medium">{loadingMessage}</p>
				<p class="text-base-content/40 text-xs">This only takes a moment</p>
			</div>
		</div>
	{/if}
{:else if !hasData}
	<div in:fly={{ y: 8, duration: 300, easing: quintOut }}>
		<NoDataState />
	</div>
{:else}
	<div in:fly={{ y: 8, duration: 300, easing: quintOut }}>
		{@render children()}
	</div>
{/if}
