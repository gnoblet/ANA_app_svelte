<script lang="ts">
	interface Props {
		activeSection: string;
	}

	let { activeSection }: Props = $props();

	const tabs = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'systems', label: 'Systems' },
		{ id: 'indicators', label: 'Indicators' },
		{ id: 'coverage', label: 'Coverage' },
		{ id: 'export', label: 'Export' }
	] as const;
</script>

<nav
	aria-label="Explore sections"
	class="flex items-stretch gap-0 overflow-x-auto"
>
	{#each tabs as tab (tab.id)}
		<a
			href="#{tab.id}"
			class={[
				'relative flex items-center px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150',
				activeSection === tab.id
					? 'text-primary after:bg-primary after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:rounded-full'
					: 'text-base-content/70 hover:text-base-content'
			].join(' ')}
			aria-current={activeSection === tab.id ? 'location' : undefined}
		>
			{tab.label}
		</a>
	{/each}
</nav>
