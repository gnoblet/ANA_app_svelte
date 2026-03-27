<script lang="ts">
	import ExclamationCircleIcon from '$lib/components/ui/ExclamationCircleIcon.svelte';
	import Chevron from '$lib/components/ui/Chevron.svelte';
	import { base } from '$app/paths';
</script>

<div class="flex flex-col items-center justify-center gap-6 py-12">
	<div class="text-center">
		<ExclamationCircleIcon size="size-16" class="text-warning mx-auto mb-4" />
		<h2 class="mb-2 text-2xl font-bold">No Data to Process</h2>
		<p class="mb-6 text-base-content/60">Please upload a CSV file and validate it first.</p>
		<a href="{base}/" class="btn btn-primary"><Chevron variant="left" /> Back to Validator</a>
	</div>
</div>
