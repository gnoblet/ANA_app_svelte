<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		options: Option[];
		selected: string[];
		placeholder?: string;
		label?: string;
		onchange?: (selected: string[]) => void;
	}

	let {
		options,
		selected,
		placeholder = 'Select…',
		label,
		onchange
	}: Props = $props();

	let open = $state(false);
	let searchQuery = $state('');
	let containerEl: HTMLDivElement | undefined = $state();

	const filtered = $derived(
		options.filter((o) => o.label.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	const allSelected = $derived(selected.length === options.length);
	const noneSelected = $derived(selected.length === 0);

	function toggle(value: string) {
		const next = selected.includes(value)
			? selected.filter((v) => v !== value)
			: [...selected, value];
		onchange?.(next);
	}

	function selectAll() {
		onchange?.(options.map((o) => o.value));
	}

	function clearAll() {
		onchange?.([]);
	}

	function removeChip(value: string) {
		onchange?.(selected.filter((v) => v !== value));
	}

	function labelFor(value: string): string {
		return options.find((o) => o.value === value)?.label ?? value;
	}

	// Close on outside click
	function onWindowClick(e: MouseEvent) {
		if (containerEl && !containerEl.contains(e.target as Node)) {
			open = false;
			searchQuery = '';
		}
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="flex flex-col gap-1" bind:this={containerEl}>
	{#if label}
		<span class="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
	{/if}

	<!-- Trigger -->
	<button
		type="button"
		class="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-left text-sm shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
		onclick={(e) => { e.stopPropagation(); open = !open; }}
	>
		<span class="flex flex-wrap gap-1">
			{#if selected.length === 0}
				<span class="text-gray-400">{placeholder}</span>
			{:else if selected.length === options.length}
				<span class="text-gray-700">All ({options.length})</span>
			{:else}
				{#each selected.slice(0, 3) as v (v)}
					<span
						class="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
					>
						{labelFor(v)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span
							class="ml-0.5 cursor-pointer opacity-60 hover:opacity-100"
							onclick={(e) => { e.stopPropagation(); removeChip(v); }}
						>×</span>
					</span>
				{/each}
				{#if selected.length > 3}
					<span class="text-xs text-gray-500">+{selected.length - 3} more</span>
				{/if}
			{/if}
		</span>
		<svg
			class="h-4 w-4 shrink-0 text-gray-400 transition-transform {open ? 'rotate-180' : ''}"
			fill="none" viewBox="0 0 24 24" stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	<!-- Dropdown -->
	{#if open}
		<div
			class="absolute z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg"
			style="margin-top: 2.5rem;"
		>
			<!-- Search -->
			<div class="border-b border-gray-100 p-2">
				<input
					type="text"
					class="input input-sm w-full"
					placeholder="Search…"
					bind:value={searchQuery}
					onclick={(e) => e.stopPropagation()}
				/>
			</div>

			<!-- Select all / clear -->
			<div class="flex gap-2 border-b border-gray-100 px-3 py-1.5">
				<button
					type="button"
					class="text-xs text-primary hover:underline disabled:opacity-40"
					disabled={allSelected}
					onclick={selectAll}
				>Select all</button>
				<span class="text-gray-300">|</span>
				<button
					type="button"
					class="text-xs text-gray-500 hover:underline disabled:opacity-40"
					disabled={noneSelected}
					onclick={clearAll}
				>Clear</button>
				<span class="ml-auto text-xs text-gray-400">
					{selected.length}/{options.length}
				</span>
			</div>

			<!-- Options list -->
			<ul class="max-h-56 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
				{#each filtered as option (option.value)}
					<li role="option" aria-selected={selected.includes(option.value)}>
						<button
							type="button"
							class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50
								{selected.includes(option.value) ? 'font-medium text-primary' : 'text-gray-700'}"
							onclick={() => toggle(option.value)}
						>
							<span
								class="flex h-4 w-4 shrink-0 items-center justify-center rounded border
									{selected.includes(option.value)
										? 'border-primary bg-primary text-white'
										: 'border-gray-300'}"
							>
								{#if selected.includes(option.value)}
									<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
									</svg>
								{/if}
							</span>
							{option.label}
						</button>
					</li>
				{:else}
					<li class="px-3 py-2 text-xs text-gray-400">No matches</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
