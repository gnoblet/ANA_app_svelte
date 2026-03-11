<script>
	import { createEventDispatcher } from 'svelte';
	import { parseFile } from './parser.js';

	// Props using Svelte 5 rune
	let { accept = '.csv', title = 'Upload CSV', hintText = '', parseOptions = {} } = $props();

	const dispatch = createEventDispatcher();
	let fileInput;
	let fileName = $state('');
	let status = $state('');

	// Handle selected files (use only first file)
	async function handleFiles(fileList) {
		if (!fileList || fileList.length === 0) return;
		const file = fileList[0];
		fileName = file.name;
		status = 'Parsing...';

		try {
			const result = await parseFile(file, parseOptions);
			// result: { header, rows, meta, errors }
			// Always emit 'parsed' with the full result; consumers can decide how to treat result.errors.
			dispatch('parsed', {
				file,
				fileName: file.name,
				header: result.header,
				rows: result.rows,
				meta: result.meta,
				errors: result.errors || []
			});

			if (result.errors && result.errors.length) {
				status = `Parsed with ${result.errors.length} error(s)`;
				dispatch('error', { message: 'Parsing produced errors', errors: result.errors });
			} else {
				status = 'Parsed';
			}
		} catch (err) {
			status = 'Failed to parse';
			dispatch('error', { message: err && err.message ? err.message : String(err) });
		}
	}

	function onInputChange(e) {
		handleFiles(e.target.files);
	}

	function clearAll() {
		if (fileInput) fileInput.value = '';
		fileName = '';
		status = '';
		dispatch('cleared');
	}
</script>

<!-- DaisyUI card with dropzone area -->
<div class="card bg-base-100 shadow">
	<div class="card-body">
		<h3 class="card-title">{title}</h3>

		{#if hintText}
			<p class="text-base-content/70 mb-4 text-sm">{@html hintText}</p>
		{/if}

		<div class="mt-4 flex items-center gap-3">
			<input
				bind:this={fileInput}
				type="file"
				{accept}
				on:change={onInputChange}
				class="file-input file-input-bordered file-input-primary flex"
			/>
			<button class="btn btn-sm" on:click={clearAll}>Clear</button>
		</div>

		<div class="text-base-content/70 mt-2 text-sm">
			Accepts: <code>{accept}</code>
		</div>
	</div>
</div>

<style>
	/* Minimal local styles retained only for small accessibility tweaks.
     Visual styling is handled by Tailwind + DaisyUI classes used in markup. */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
