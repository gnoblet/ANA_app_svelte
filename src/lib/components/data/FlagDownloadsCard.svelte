<script lang="ts">
	import Select from '$lib/components/ui/Select.svelte';

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
		onDownloadDeepDive
	}: Props = $props();
</script>

<div class="card bg-base-100 border-base-300 border shadow-sm">
	<div class="card-body space-y-5">
		<!-- Flat exports -->
		<div>
			<p class="text-base-content/50 mb-3 text-xs font-semibold tracking-widest uppercase">
				Export dataset
			</p>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<!-- JSON -->
				<button
					class="group border-base-300 hover:border-primary hover:bg-primary/5 flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-150"
					onclick={onDownloadJSON}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-base-content/35 group-hover:text-primary size-7 shrink-0 transition-colors duration-150"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline
							points="14 2 14 8 20 8"
						/>
						<line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
					</svg>
					<div>
						<p class="text-sm font-semibold">JSON</p>
						<p class="text-base-content/45 text-xs">Nested · programmatic</p>
					</div>
				</button>

				<!-- CSV -->
				<button
					class="group border-base-300 hover:border-primary hover:bg-primary/5 flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-150"
					onclick={onDownloadCSV}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-base-content/35 group-hover:text-primary size-7 shrink-0 transition-colors duration-150"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<rect x="3" y="3" width="18" height="18" rx="2" />
						<line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
						<line x1="9" y1="3" x2="9" y2="21" />
					</svg>
					<div>
						<p class="text-sm font-semibold">CSV</p>
						<p class="text-base-content/45 text-xs">Flat · Excel / R / Python</p>
					</div>
				</button>

				<!-- XLSX -->
				<button
					class="group border-base-300 hover:border-primary hover:bg-primary/5 flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-150"
					onclick={onDownloadXLSX}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="text-base-content/35 group-hover:text-primary size-7 shrink-0 transition-colors duration-150"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline
							points="14 2 14 8 20 8"
						/>
						<path d="M8 13l2 2 4-4" />
					</svg>
					<div>
						<p class="text-sm font-semibold">Excel (XLSX)</p>
						<p class="text-base-content/45 text-xs">Native workbook</p>
					</div>
				</button>
			</div>
		</div>

		<!-- Deep dives -->
		<div class="border-base-300 border-t pt-5">
			<p class="text-base-content/50 mb-3 text-xs font-semibold tracking-widest uppercase">
				Deep-dive workbooks
			</p>
			<p class="text-base-content/60 mb-4 text-sm">
				One pre-filled XLSX per selected UoA — indicator values and preliminary flags — delivered as
				a single ZIP.
			</p>
			<div class="flex flex-wrap items-end gap-4">
				<div class="max-w-72 min-w-60 flex-1">
					<Select
						label="Units of analysis ({count} total)"
						options={uoaOptions.map((v) => ({ value: v, label: v }))}
						selected={selectedUoas}
						onchange={(v) => onUoasChange(v as string[])}
					/>
				</div>
				<button
					class="btn btn-primary btn-sm"
					disabled={selectedUoas.length === 0}
					onclick={onDownloadDeepDive}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="size-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
							points="7 10 12 15 17 10"
						/><line x1="12" y1="15" x2="12" y2="3" />
					</svg>
					Download ZIP ({selectedUoas.length} UoA{selectedUoas.length !== 1 ? 's' : ''})
				</button>
			</div>
		</div>
	</div>
</div>
