<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		left?: number;
		top?: number;
		children?: Snippet;
	}

	let { left = 0, top = 0, children }: Props = $props();
</script>

<g transform="translate({left},{top})">
	{@render children?.()}
</g>
