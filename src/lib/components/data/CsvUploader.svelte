<script lang="ts">
	import { parseFile } from '$lib/engine/parser';
	import ButtonClear from '$lib/components/ui/ButtonClear.svelte';

	interface ParseResult {
		file: File;
		fileName: string;
		header: string[];
		rows: unknown[];
		meta: unknown;
		errors: { message?: string; [key: string]: unknown }[];
	}

	interface Props {
		accept?: string;
		hintText?: string;
		parseOptions?: Record<string, unknown>;
		onparsed?: (result: ParseResult) => void;
		onerror?: (detail: { message: string; errors?: unknown[] }) => void;
		oncleared?: () => void;
	}

	let {
		accept = '.csv',
		hintText = '',
		parseOptions = {},
		onparsed,
		onerror,
		oncleared
	}: Props = $props();

	let fileInput = $state<HTMLInputElement | null>(null);
	let fileName = $state('');
	let status = $state<'idle' | 'parsing' | 'done' | 'error'>('idle');
	let isDragging = $state(false);

	async function handleFiles(fileList: FileList | null) {
		if (!fileList || fileList.length === 0) return;
		const file = fileList[0];
		fileName = file.name;
		status = 'parsing';

		try {
			const result = await parseFile(file, parseOptions);
			const detail: ParseResult = {
				file,
				fileName: file.name,
				header: result.header,
				rows: result.rows,
				meta: result.meta,
				errors: result.errors || []
			};

			if (result.errors && result.errors.length) {
				status = 'error';
				onerror?.({ message: 'Parsing produced errors', errors: result.errors });
			} else {
				status = 'done';
			}
			onparsed?.(detail);
		} catch (err) {
			status = 'error';
			onerror?.({ message: err instanceof Error ? err.message : String(err) });
		}
	}

	function onInputChange(e: Event) {
		handleFiles((e.target as HTMLInputElement).files);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		handleFiles(e.dataTransfer?.files ?? null);
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function onDragLeave() {
		isDragging = false;
	}

	function clearAll() {
		if (fileInput) fileInput.value = '';
		fileName = '';
		status = 'idle';
		isDragging = false;
		oncleared?.();
	}
</script>

<div
	role="region"
	aria-label="CSV file upload"
	class={[
		'rounded-box border-2 border-dashed px-6 py-8 text-center transition-colors duration-150',
		isDragging
			? 'border-primary bg-primary/8'
			: status === 'done'
				? 'border-success/50 bg-success/5'
				: status === 'error'
					? 'border-error/50 bg-error/5'
					: 'border-base-300 hover:border-primary/40'
	].join(' ')}
	ondrop={onDrop}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
>
	<!-- Icon -->
	<div class="flex justify-center">
		{#if status === 'parsing'}
			<span class="loading loading-spinner loading-md text-primary"></span>
		{:else if status === 'done'}
			<svg xmlns="http://www.w3.org/2000/svg" class="text-success size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
				<polyline points="22 4 12 14.01 9 11.01"/>
			</svg>
		{:else if status === 'error'}
			<svg xmlns="http://www.w3.org/2000/svg" class="text-error size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="12" cy="12" r="10"/>
				<line x1="12" y1="8" x2="12" y2="12"/>
				<line x1="12" y1="16" x2="12.01" y2="16"/>
			</svg>
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" class="text-base-content/25 size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
				<polyline points="17 8 12 3 7 8"/>
				<line x1="12" y1="3" x2="12" y2="15"/>
			</svg>
		{/if}
	</div>

	<!-- Status text -->
	<div class="mt-3">
		{#if status === 'parsing'}
			<p class="text-sm font-medium">Parsing…</p>
		{:else if status === 'done'}
			<p class="text-success text-sm font-semibold">{fileName}</p>
			<p class="text-base-content/45 mt-0.5 text-xs">Parsed successfully</p>
		{:else if status === 'error'}
			<p class="text-error text-sm font-semibold">{fileName || 'Parse failed'}</p>
			<p class="text-base-content/45 mt-0.5 text-xs">See errors below</p>
		{:else}
			<p class="text-sm font-medium">
				{isDragging ? 'Drop to upload' : 'Drop a CSV here, or click Browse'}
			</p>
			{#if hintText}
				<p class="text-base-content/45 mt-1 text-xs">{@html hintText}</p>
			{/if}
		{/if}
	</div>

	<!-- Browse button + clear -->
	<div class="mt-4 flex items-center justify-center gap-2">
		<label class="btn btn-primary btn-sm cursor-pointer">
			Browse
			<input
				bind:this={fileInput}
				type="file"
				{accept}
				onchange={onInputChange}
				class="sr-only"
				aria-label="Choose a CSV file"
			/>
		</label>
		{#if status !== 'idle'}
			<ButtonClear size="sm" onclick={clearAll} />
		{/if}
	</div>
</div>
