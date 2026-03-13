<script>
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import { writable, derived, get } from 'svelte/store';
	import {
		getAllIndicatorIds,
		buildSubfactorList,
		getIndicatorMetadata
	} from '$lib/access/access_indicators.js';

	// Stores for local state
	const indicatorsJson = writable(null);
	const loadError = writable(null);
	const loading = writable(true);

	// UI state stores
	const filter = writable('');
	const selected = writable([]); // selected indicator ids
	const showRaw = writable(false);

	// Derived stores (replaces $: reactive statements)
	const allIds = derived(indicatorsJson, ($ind) => ($ind ? getAllIndicatorIds($ind) : []));
	const subList = derived(indicatorsJson, ($ind) => ($ind ? buildSubfactorList($ind) : []));
	const filteredIds = derived([allIds, filter], ([$all, $filter]) =>
		$filter ? $all.filter((id) => id.includes($filter)) : $all
	);
	const selectedMetadata = derived([indicatorsJson, selected], ([$ind, $sel]) =>
		$ind && $sel && $sel.length ? $sel.map((id) => getIndicatorMetadata($ind, id)) : []
	);

	// Fetch indicators.json on client only
	onMount(async () => {
		loading.set(true);
		loadError.set(null);
		try {
			const res = await fetch(asset('/data/indicators.json'));
			if (!res.ok) {
				loadError.set(`Failed to fetch indicators.json: ${res.status} ${res.statusText}`);
				indicatorsJson.set(null);
			} else {
				indicatorsJson.set(await res.json());
			}
		} catch (err) {
			loadError.set(String(err));
			indicatorsJson.set(null);
		} finally {
			loading.set(false);
		}
	});

	// UI handlers: these read/write stores via get() or .set()
	function onSelectChange(e) {
		const opts = Array.from(e.target.selectedOptions || []);
		selected.set(opts.map((o) => o.value));
	}

	function toggleSelectAll() {
		const visible = get(filteredIds);
		if (!visible || visible.length === 0) return;
		const curSelected = get(selected);
		const allVisibleSelected = visible.every((id) => curSelected.includes(id));
		if (allVisibleSelected) {
			selected.set(curSelected.filter((id) => !visible.includes(id)));
		} else {
			const add = visible.filter((id) => !curSelected.includes(id));
			selected.set([...curSelected, ...add]);
		}
	}

	function downloadSelectedJSON() {
		const payload = get(selectedMetadata);
		const json = JSON.stringify(payload, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const now = new Date().toISOString().replace(/[:.]/g, '-');
		a.download = `accessors_selected_${now}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function copyJSONToClipboard() {
		const json = JSON.stringify(get(selectedMetadata), null, 2);
		if (navigator.clipboard && navigator.clipboard.writeText) {
			try {
				await navigator.clipboard.writeText(json);
				alert('Selected metadata copied to clipboard');
			} catch (err) {
				alert('Copy failed: ' + err);
			}
		} else {
			try {
				const dummy = document.createElement('textarea');
				dummy.value = json;
				document.body.appendChild(dummy);
				dummy.select();
				document.execCommand('copy');
				document.body.removeChild(dummy);
				alert('Selected metadata copied to clipboard (fallback)');
			} catch (err) {
				alert('Copy failed: ' + err);
			}
		}
	}
</script>

<div class="container">
	<h1>Test Accessors</h1>

	{#if $loading}
		<p class="small">Loading indicators.json…</p>
	{:else if $loadError}
		<p class="small" style="color:crimson">Error loading indicators.json: {$loadError}</p>
	{:else}
		<p class="hint">
			Select one or more indicator IDs from the list below to inspect their metadata and location in
			the indicators.json structure. Use the filter box to quickly narrow the ID list.
		</p>

		<div class="controls">
			<div style="display:flex;flex-direction:column;">
				<label for="filter">Filter IDs</label>
				<input id="filter" type="text" bind:value={$filter} placeholder="e.g. IND00" />
			</div>

			<div style="display:flex;flex-direction:column;">
				<div class="actions" role="group" aria-label="Indicator actions">
					<button type="button" on:click={toggleSelectAll}>Toggle select visible</button>
					<button
						type="button"
						on:click={() => {
							selected.set([]);
						}}>Clear selection</button
					>
					<button
						type="button"
						on:click={downloadSelectedJSON}
						disabled={get(selected).length === 0}>Download JSON</button
					>
					<button type="button" on:click={copyJSONToClipboard} disabled={get(selected).length === 0}
						>Copy JSON</button
					>
					<label style="display:flex;align-items:center;gap:6px;margin-left:8px;">
						<input type="checkbox" bind:checked={$showRaw} />
						Show raw entry JSON
					</label>
				</div>
			</div>
		</div>

		<div class="selector">
			<div>
				<label for="ids"
					>Indicator IDs ({$filteredIds.length} visible / {$allIds.length} total)</label
				>
				<br />
				<select id="ids" multiple size="14" on:change={onSelectChange}>
					{#if $filteredIds.length === 0}
						<option disabled>No IDs match filter</option>
					{/if}
					{#each $filteredIds as id}
						<option value={id} selected={get(selected).includes(id)}>{id}</option>
					{/each}
				</select>
			</div>

			<div style="flex:1;">
				<div class="meta">
					<div style="display:flex;justify-content:space-between;align-items:center;">
						<div>
							<strong>Selected:</strong>
							{get(selected).length} id(s)
							{#if get(selected).length > 0}
								<span class="small"> — {get(selected).join(', ')}</span>
							{/if}
						</div>
					</div>

					{#if get(selected).length === 0}
						<p class="small">No indicators selected. Select some IDs to view metadata.</p>
					{/if}

					{#if get(selected).length > 0}
						<table>
							<thead>
								<tr>
									<th>Indicator</th>
									<th>Label</th>
									<th>System</th>
									<th>Factor</th>
									<th>Subfactor</th>
									<th>Key threshold(s)</th>
								</tr>
							</thead>
							<tbody>
								{#each $selectedMetadata as meta (meta ? meta.indicator : Math.random())}
									<tr>
										<td>{meta ? meta.indicator : 'N/A'}</td>
										<td>{meta && meta.indicator_label ? meta.indicator_label : '—'}</td>
										<td>{meta ? meta.systemId : '—'}</td>
										<td>{meta ? meta.factorId : '—'}</td>
										<td>{meta && meta.subfactorId ? meta.subfactorId : '—'}</td>
										<td>
											{#if meta && meta.raw && meta.raw.thresholds}
												{#if meta.raw.thresholds.an !== undefined}
													AN: {String(meta.raw.thresholds.an)}<br />
												{/if}
												{#if meta.raw.thresholds.van !== undefined}
													VAN: {String(meta.raw.thresholds.van)}
												{/if}
												{#if meta.raw.above_or_below}
													<div class="small">Dir: {meta.raw.above_or_below}</div>
												{/if}
											{:else}
												<span class="small">no thresholds</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>

						{#if $showRaw}
							<h3 style="margin-top:1rem;">Raw entries</h3>
							{#each $selectedMetadata as meta}
								<div style="margin-bottom:0.6rem;">
									<strong>{meta?.indicator}</strong>
									<pre>{JSON.stringify(meta?.raw ?? {}, null, 2)}</pre>
								</div>
							{/each}
						{/if}
					{/if}
				</div>
			</div>
		</div>

		<hr style="margin:1.2rem 0;" />

		<section>
			<h3>Subfactor list (sample)</h3>
			<p class="small">This shows canonical subfactor paths discovered in the indicators.json.</p>
			{#if $subList.length === 0}
				<p class="small">No subfactors found.</p>
			{:else}
				<ul>
					{#each $subList.slice(0, 30) as s}
						<li><strong>{s.path}</strong> — {s.codes.length} indicators</li>
					{/each}
				</ul>
				{#if $subList.length > 30}
					<p class="small">(...and {$subList.length - 30} more)</p>
				{/if}
			{/if}
		</section>
	{/if}
</div>

<style>
	.container {
		padding: 1rem;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			Roboto,
			'Helvetica Neue',
			Arial;
	}

	.controls {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.selector {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	select {
		min-width: 320px;
		width: 420px;
		max-width: 100%;
	}

	.meta {
		margin-top: 1rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.5rem;
	}

	th,
	td {
		padding: 0.4rem 0.6rem;
		border: 1px solid #ddd;
		text-align: left;
		vertical-align: top;
		font-size: 0.92rem;
	}

	th {
		background: #f7f7f7;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.small {
		font-size: 0.9rem;
		color: #555;
	}

	.hint {
		color: #666;
		font-size: 0.9rem;
	}

	pre {
		background: #0f1720;
		color: #e6eef8;
		padding: 0.6rem;
		overflow: auto;
		max-height: 30vh;
	}
</style>
