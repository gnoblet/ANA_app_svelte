<script lang="ts">
	import { onMount } from 'svelte';
	import ValidatorView from '$lib/components/ValidatorView.svelte';
	import FlagView from '$lib/components/FlagView.svelte';
	import { loadIndicators, flattenIndicators } from '$lib/processing/indicators.js';

	interface FlaggingData {
		header: string[];
		rows: Record<string, number | null>[];
		indicatorMap: Record<string, unknown>;
	}

	let indicatorMap: Record<string, unknown> = {};
	let flaggingData: FlaggingData | null = null;

	function handleDataReset() {
		flaggingData = null;
	}

	onMount(() => {
		// Load indicators
		loadIndicators()
			.then((json) => {
				indicatorMap = flattenIndicators(json);
			})
			.catch((err) => {
				console.error(err && err.message ? err.message : String(err));
				indicatorMap = {};
			});
	});

	function handleFlagClick(data: FlaggingData) {
		flaggingData = data;
	}

	function handleBackClick() {
		// Just let the anchor link handle it
	}
</script>

<div class="w-full">
	<!-- Validator View Section -->
	<div id="validator">
		<ValidatorView {indicatorMap} onFlagClick={handleFlagClick} onDataReset={handleDataReset} />
	</div>

	<!-- Flagging View Section -->
	<div id="flagging">
		<div class="card card-border bg-base-100 w-full shadow-sm">
			<FlagView {flaggingData} onBackClick={handleBackClick} />
		</div>
	</div>
</div>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}
</style>
