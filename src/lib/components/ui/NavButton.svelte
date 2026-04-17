<script lang="ts">
	import Chevron from '$lib/components/ui/Chevron.svelte';
	import { goto } from '$app/navigation';

	interface Props {
		/** URL to navigate to */
		href: string;
		/** Button label */
		label: string;
		/** Direction of the chevron — also controls its position (left = before label, right = after) */
		direction?: 'back' | 'forward';
		/** Visual variant */
		variant?:
			| 'outline'
			| 'primary'
			| 'secondary'
			| 'warning'
			| 'success'
			| 'error'
			| 'neutral'
			| 'accent';
		/** Additional CSS classes */
		class?: string;
		/** Size */
		size?: 'sm' | 'md' | 'lg';
	}

	let {
		href,
		label,
		direction = 'back',
		variant = 'outline',
		size = 'sm',
		class: additionalClasses = ''
	}: Props = $props();

	// Derive variant and size classes based on props
	// just concatenate strings: variant and bt-
	const variantCls = $derived(`btn-${variant}`);
	const sizeCls = $derived(size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : 'btn-md');

	const handleClick = () => goto(href);
</script>

<button onclick={handleClick} class="btn {variantCls} {sizeCls} {additionalClasses}">
	{#if direction === 'back'}
		<Chevron variant="left" />{label}
	{:else}
		{label}<Chevron variant="right" />
	{/if}
</button>
