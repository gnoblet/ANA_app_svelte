<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import ValidatorView from '$lib/components/ValidatorView.svelte';
	import Chevron from '$lib/components/ui/Chevron.svelte';
	import { loadIndicatorsIntoStore } from '$lib/stores/indicatorsStore.svelte';
	import { flagStore } from '$lib/stores/flagStore.svelte';
	import { validatorStore } from '$lib/stores/validatorStore.svelte';

	let validationPassed = $state(false);

	// True when there are stored results but the validator is idle (cleared after flagging).
	const hasPreviousResults = $derived(
		flagStore.flaggedResult !== null &&
			flagStore.flaggedResult.length > 0 &&
			!validatorStore.validationResult
	);

	onMount(() => {
		loadIndicatorsIntoStore();
	});

	function handleValidationPassed() {
		validationPassed = true;
	}

	function handleReset() {
		validationPassed = false;
	}
</script>

{#if hasPreviousResults && !validationPassed}
	<div role="alert" class="alert alert-success mb-4 flex items-center justify-between">
		<div>
			<p class="font-semibold">Previous results available</p>
			<p class="text-sm">
				Your last dataset was flagged successfully. The validator has been cleared, but your results
				are still saved. To validate new data, upload a file above.
			</p>
			{#if flagStore.filename || flagStore.uploadedAt}
				<p class="mt-1 text-xs opacity-75">
					{#if flagStore.filename}<span class="font-medium">{flagStore.filename}</span>{/if}
					{#if flagStore.uploadedAt}
						— processed at {new Date(flagStore.uploadedAt).toLocaleString()}
					{/if}
				</p>
			{/if}
		</div>
		<a href={resolve('/viz')} class="btn btn-outline ml-4 shrink-0">View Results <Chevron variant="right" /></a>
	</div>
{/if}

<ValidatorView onValidationPassed={handleValidationPassed} onReset={handleReset} />

{#if validationPassed}
	<div class="mt-4 flex justify-center">
		<a href={resolve('/viz')} class="btn btn-primary btn-lg">Go to Results <Chevron variant="right" /></a>
	</div>
{/if}

<style>
	:global(html) {
		scroll-behavior: smooth;
	}
</style>
