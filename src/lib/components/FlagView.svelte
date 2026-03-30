<script lang="ts">
	import { onMount } from 'svelte';
	import { flagData, downloadJSON, downloadCSV, downloadXLSX } from '$lib/processing/flagger.js';
	import { downloadDeepDiveZip } from '$lib/processing/deepdive.js';
	import Select from '$lib/components/ui/Select.svelte';
	import DataTable from '$lib/components/ui/DataTable.svelte';
	import { flagStore, setFlagResult, clearFlagResult } from '$lib/stores/flagStore.svelte';
	import Chevron from '$lib/components/ui/Chevron.svelte';
	import CheckCircleIcon from '$lib/components/ui/CheckCircleIcon.svelte';
	import ExclamationCircleIcon from '$lib/components/ui/ExclamationCircleIcon.svelte';
	import NoDataState from '$lib/components/ui/NoDataState.svelte';
	import { validatorStore, clearValidatorState } from '$lib/stores/validatorStore.svelte';
	import { indicatorsStore } from '$lib/stores/indicatorsStore.svelte';
	import { base } from '$app/paths';

	let flaggedResult: Record<string, unknown>[] | null = $state(null);
	let isProcessing = $state(false);
	let error = $state('');
	let selectedUoas = $state<string[]>([]);

	const uoaOptions = $derived.by((): string[] => {
		if (!flaggedResult) return [];
		return [...new Set(flaggedResult.map((r) => String(r['uoa'] ?? '')))];
	});

	$effect(() => {
		if (uoaOptions.length > 0 && selectedUoas.length === 0) {
			selectedUoas = [...uoaOptions];
		}
	});

	onMount(() => {
		const stored = flagStore.flaggedResult;
		const validator = validatorStore;

		if (stored && stored.length > 0) {
			// Rehydrate from a previous flagging run
			flaggedResult = stored;
		} else if (
			validator.validationResult &&
			(validator.validationResult as any).ok &&
			(validator.validationResult as any).numericObjects?.length > 0
		) {
			// Validation passed and no flagging done yet — run automatically
			runFlagging(
				(validator.validationResult as any).numericObjects,
				validator.filename ?? undefined
			);
		}
	});

	async function runFlagging(rows: Record<string, number | null>[], filename?: string) {
		isProcessing = true;
		error = '';
		flaggedResult = null;

		try {
			const json = indicatorsStore.indicatorsJson;
			if (!json) {
				throw new Error(
					'Indicators metadata is not loaded yet. Please wait a moment and try again.'
				);
			}

			const result = flagData(rows, json);
			flaggedResult = result;
			const metadataCols =
				((validatorStore.validationResult as any)?.metadataCols as string[]) ?? [];
			setFlagResult(result, filename ?? null, metadataCols);
			clearValidatorState();
		} catch (err) {
			error = `Flagging failed: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			isProcessing = false;
		}
	}

	function handleDownloadJSON() {
		if (!flaggedResult) return;
		const timestamp = new Date().toISOString().split('T')[0];
		downloadJSON(flaggedResult, `flagged_data_${timestamp}.json`);
	}

	function handleDownloadCSV() {
		if (!flaggedResult) return;
		const timestamp = new Date().toISOString().split('T')[0];
		downloadCSV(flaggedResult, `flagged_data_${timestamp}.csv`);
	}

	function handleDownloadXLSX() {
		if (!flaggedResult) return;
		const timestamp = new Date().toISOString().split('T')[0];
		downloadXLSX(flaggedResult, `flagged_data_${timestamp}.xlsx`);
	}

	async function handleDownloadDeepDiveZip() {
		if (!flaggedResult || selectedUoas.length === 0) return;
		const json = indicatorsStore.indicatorsJson;
		if (!json) return;
		const rows = flaggedResult.filter((r) => selectedUoas.includes(String(r['uoa'] ?? '')));
		if (rows.length === 0) return;
		const timestamp = new Date().toISOString().split('T')[0];
		const hypothesesResp = await fetch(`${base}/data/hypotheses.json`);
		const hypothesesData = await hypothesesResp.json();
		await downloadDeepDiveZip(rows, json, hypothesesData, `deepdives_${timestamp}.zip`);
	}

	function handleClear() {
		flaggedResult = null;
		error = '';
		clearFlagResult();
	}

	const PRELIM_BADGE: Record<string, { bg: string; label: string }> = {
		EM: { bg: 'var(--color-em)', label: 'EM' },
		ROEM: { bg: 'var(--color-roem)', label: 'RoEM' },
		ACUTE: { bg: 'var(--color-an)', label: 'Acute Needs' },
		INSUFFICIENT_EVIDENCE: { bg: 'var(--color-nodata)', label: 'Insufficient Data' },
		NO_ACUTE_NEEDS: { bg: 'var(--color-noan)', label: 'No Acute Needs' }
	};

	const tableColumns = $derived.by(() => {
		if (!flaggedResult || flaggedResult.length === 0) return [] as string[];
		const keys = Object.keys(flaggedResult[0]);
		const rest = keys.filter((k) => k !== 'uoa' && k !== 'prelim_flag');
		return ['uoa', 'prelim_flag', ...rest];
	});

	const tableData = $derived.by(() => {
		if (!flaggedResult) return [] as string[][];
		return flaggedResult.map((row) =>
			tableColumns.map((col) => {
				const v = row[col];
				return typeof v === 'boolean' ? (v ? '✓' : '✗') : String(v ?? '–');
			})
		);
	});
</script>

<div class="card bg-white shadow">
	<div class="card-body">
		{#if isProcessing}
			<div class="flex flex-col items-center justify-center gap-4 py-8">
				<div class="text-lg">Processing data...</div>
				<span class="loading loading-spinner loading-lg text-primary"></span>
			</div>
		{:else if error}
			<div class="flex flex-col items-center justify-center gap-6 py-12">
				<div class="text-center">
					<ExclamationCircleIcon size="size-16" class="text-error mx-auto mb-4" />
					<h2 class="mb-2 text-2xl font-bold">Error Processing Data</h2>
					<p class="mb-6 text-base-content/60">{error}</p>
					<a href="{base}/" class="btn btn-primary"><Chevron variant="left" /> Back to Validator</a>
				</div>
			</div>
		{:else if flaggedResult}
			<div class="space-y-4">
				<div class="alert alert-success">
					<CheckCircleIcon size="size-6" class="shrink-0" />
					<span
						>Successfully flagged {flaggedResult.length} unit(s) of analysis against thresholds</span
					>
				</div>

				<div class="divider">Data Preview</div>

				<DataTable
					columns={tableColumns}
					data={tableData}
					pageSize={5}
				>
					{#snippet renderCell({ col, value }: { col: string; value: string })}
						{#if col === 'prelim_flag'}
							{@const badge = PRELIM_BADGE[value]}
							{#if badge}
								<span
									class="inline-block rounded px-2 py-0.5 text-xs font-medium leading-snug"
									style="background-color: {badge.bg}; color: var(--color-base-content);"
								>{badge.label}</span>
							{:else}
								{value}
							{/if}
						{:else}
							{value}
						{/if}
					{/snippet}
				</DataTable>

				<div class="divider">Deep Dive Export</div>

				<div class="flex flex-wrap items-end gap-3">
					<div class="w-72">
						<Select
							options={uoaOptions.map((v) => ({ value: v, label: v }))}
							selected={selectedUoas}
							onchange={(v) => (selectedUoas = v as string[])}
							label="Units of analysis"
						/>
					</div>
					<button
						class="btn btn-secondary btn-sm"
						disabled={selectedUoas.length === 0}
						onclick={handleDownloadDeepDiveZip}
					>
						Download Deep Dive ZIP
					</button>
				</div>

				<div class="divider">Actions</div>

				<div class="flex flex-wrap gap-2">
					<button class="btn btn-primary" onclick={handleDownloadJSON}>Download JSON</button>
					<button class="btn btn-primary" onclick={handleDownloadCSV}>Download CSV</button>
					<button class="btn btn-primary" onclick={handleDownloadXLSX}>Download XLSX</button>
					<button class="btn btn-outline btn-error" onclick={handleClear}>Clear</button>
					<a href="{base}/" class="btn btn-outline"><Chevron variant="left" /> Back to Validator</a>
				</div>
			</div>
		{:else}
			<NoDataState />
		{/if}
	</div>
</div>
