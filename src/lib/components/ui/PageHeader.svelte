<script lang="ts">
	interface Props {
		/** Page title */
		title: string;
		/** Optional subtitle shown below the title */
		subtitle?: string;
		/** Optional extra classes on the wrapper <div> */
		class?: string;
	}

	let { title, subtitle, class: cls = '' }: Props = $props();
</script>

<div class="mb-6 {cls}">
	<h1 class="text-2xl font-semibold">{title}</h1>
	{#if subtitle}
		<p class="text-base-content/60 mt-1 text-sm">{subtitle}</p>
	{/if}
</div>
