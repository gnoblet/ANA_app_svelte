<script lang="ts">
	import Chevron from '$lib/components/ui/Chevron.svelte';

	interface Props {
		/** URL to navigate to */
		href: string;
		/** Button label */
		label: string;
		/** Direction of the chevron — also controls its position (left = before label, right = after) */
		direction?: 'back' | 'forward';
		/** Visual variant */
		variant?: 'outline' | 'primary';
		/** Size */
		size?: 'sm' | 'md' | 'lg';
	}

	let { href, label, direction = 'back', variant = 'outline', size = 'md' }: Props = $props();

	const variantCls = $derived(variant === 'primary' ? 'btn-primary' : 'btn-outline');
	const sizeCls = $derived(size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : 'btn-md');
</script>

<a {href} class="btn {variantCls} {sizeCls}">
	{#if direction === 'back'}
		<Chevron variant="left" />{label}
	{:else}
		{label}<Chevron variant="right" />
	{/if}
</a>
