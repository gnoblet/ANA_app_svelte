<script>
	import { createEventDispatcher } from 'svelte';
	import { parseFile } from './parser.js';

	// Props
	export let accept = '.csv';
	// parseOptions forwarded to parseFile (PapaParse options); default keeps header:false
	export let parseOptions = {};

	const dispatch = createEventDispatcher();
	let fileInput;
	let fileName = '';
	let status = '';
	let dragOver = false;

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

	function onDrop(e) {
		e.preventDefault();
		dragOver = false;
		handleFiles(e.dataTransfer.files);
	}

	function onDragOver(e) {
		e.preventDefault();
		dragOver = true;
	}

	function onDragLeave() {
		dragOver = false;
	}

	function openFilePicker() {
		if (fileInput) fileInput.click();
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
		<h3 class="card-title">Upload CSV</h3>

		<div
			class="hover:bg-base-200 rounded-lg border-2 border-dashed p-6 text-center focus:ring focus:outline-none"
			class:opacity-80={dragOver}
			on:drop|preventDefault={onDrop}
			on:dragover|preventDefault={onDragOver}
			on:dragleave={onDragLeave}
			on:click={openFilePicker}
			role="button"
			tabindex="0"
			aria-label="Upload CSV file (click or drop file here)"
		>
			<div class="text-lg font-medium">Drop CSV file here</div>
			<div class="text-base-content/60 mt-2 text-sm">or click to select a file</div>

			<input bind:this={fileInput} type="file" {accept} on:change={onInputChange} class="hidden" />
		</div>

		<div class="mt-4 flex items-center gap-2">
			<button class="btn btn-sm" on:click={openFilePicker}>Choose file</button>
			<button class="btn btn-sm btn-ghost" on:click={clearAll}>Clear</button>
			<div class="text-base-content/70 ml-auto text-sm">
				Accepts: <code class="ml-1">{accept}</code>
			</div>
		</div>

		{#if fileName}
			<div class="mt-3 text-sm">
				<strong>{fileName}</strong>
				<div class="text-base-content/60">{status}</div>
			</div>
		{/if}
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
