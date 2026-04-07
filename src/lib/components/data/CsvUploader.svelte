<script>
	import { createEventDispatcher } from 'svelte';
	import { parseFile } from '$lib/processing/parser';

	// Props using Svelte 5 rune
	let {
		accept = '.csv',
		title = 'Upload CSV',
		hintText = '',
		parseOptions = {},
		bgClass = '',
		shadowClass = ''
	} = $props();

	const dispatch = createEventDispatcher();
	let fileInput;
	let fileName;

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
<div class="card {bgClass} mx-auto {shadowClass}">
	<div class="card-body items-center text-center">
		<h3 class="card-title">{title}</h3>

		{#if hintText}
			<p class=" mb-4">{@html hintText}</p>
		{/if}

		<div class="mt-4 flex items-center justify-center gap-3">
			<input
				bind:this={fileInput}
				type="file"
				{accept}
				onchange={onInputChange}
				class="file-input file-input-bordered file-input-secondary"
			/>
			<button class="btn btn-md btn-outline" onclick={clearAll}>Clear</button>
		</div>

		<div class="mt-2 text-sm">
			Accepts: <code>{accept}</code>
		</div>
	</div>
</div>
