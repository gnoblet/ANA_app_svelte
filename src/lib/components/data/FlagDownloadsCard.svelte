<script lang="ts">
	import Select from '$lib/components/ui/Select.svelte';
	import CheckCircleIcon from '$lib/components/ui/CheckCircleIcon.svelte';
	import ButtonClear from '$lib/components/ui/ButtonClear.svelte';

	interface Props {
		count: number;
		uoaOptions: string[];
		selectedUoas: string[];
		onUoasChange: (v: string[]) => void;
		onDownloadJSON: () => void;
		onDownloadCSV: () => void;
		onDownloadXLSX: () => void;
		onDownloadDeepDive: () => void;
		onClear: () => void;
	}

	let {
		count,
		uoaOptions,
		selectedUoas,
		onUoasChange,
		onDownloadJSON,
		onDownloadCSV,
		onDownloadXLSX,
		onDownloadDeepDive,
		onClear
	}: Props = $props();
</script>

<div class="card bg-base-100 border-base-300/40 border shadow-sm">
	<div class="card-body space-y-4">
		<h2 class="card-title text-base">Downloads</h2>
		<div class="alert alert-success">
			<CheckCircleIcon size="size-6" class="shrink-0" />
			<span
				>{count} unit{count !== 1 ? 's' : ''} of analysis processed against thresholds</span
			>
		</div>

		<div class="divider">Download Results</div>

		<div class="flex flex-wrap gap-3">
			<button class="btn btn-primary btn-md" onclick={onDownloadJSON}>Download JSON</button>
			<button class="btn btn-primary btn-md" onclick={onDownloadCSV}>Download CSV</button>
			<button class="btn btn-primary btn-md" onclick={onDownloadXLSX}>Download XLSX</button>
			<ButtonClear size="md" onclick={onClear} />
		</div>

		<div class="divider">Deep Dives</div>

		<div class="flex flex-wrap items-end gap-4">
			<div class="w-72">
				<Select
					options={uoaOptions.map((v) => ({ value: v, label: v }))}
					selected={selectedUoas}
					onchange={(v) => onUoasChange(v as string[])}
					label="Units of analysis"
				/>
			</div>
			<button
				class="btn btn-secondary btn-md"
				disabled={selectedUoas.length === 0}
				onclick={onDownloadDeepDive}
			>
				Download Deep Dive ZIP
			</button>
		</div>
	</div>
</div>
