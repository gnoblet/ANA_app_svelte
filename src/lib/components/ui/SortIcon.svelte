<script lang="ts">
	interface Props {
		active: boolean;
		asc?: boolean;
		class?: string;
	}
	let { active, asc = true, class: cls = '' }: Props = $props();
</script>

<svg
	aria-hidden="true"
	class="size-3 shrink-0 {active ? '' : 'opacity-30'} {cls}"
	viewBox="0 0 12 12"
	fill="currentColor"
>
	{#if active}
		{#if asc}
			<path d="M6 2l4 6H2z" />
		{:else}
			<path d="M6 10L2 4h8z" />
		{/if}
	{:else}
		<path d="M6 1l3 4H3zM6 11L3 7h6z" />
	{/if}
</svg>
