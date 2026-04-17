<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';

	interface Props {
		activeSection: string;
		visible?: boolean;
	}

	let { activeSection, visible = true }: Props = $props();

	const opacity = new Tween(0, { duration: 600, easing: cubicInOut });
	$effect(() => {
		opacity.set(visible ? 1 : 0);
	});

	const tabs = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'systems', label: 'Systems' },
		{ id: 'metrics', label: 'Metrics' },
		{ id: 'coverage', label: 'Coverage' },
		{ id: 'export', label: 'Export' }
	] as const;
</script>

<nav aria-label="Explore sections" class="flex items-center gap-1 overflow-x-auto">
	{#each tabs as tab (tab.id)}
		<a
			href="#{tab.id}"
			class={[
				'rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-150',
				activeSection === tab.id
					? 'bg-primary text-primary-content'
					: 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
			].join(' ')}
			aria-current={activeSection === tab.id ? 'location' : undefined}
		>
			{tab.label}
		</a>
	{/each}
</nav>
