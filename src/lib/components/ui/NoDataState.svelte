<script lang="ts">
	import ExclamationCircleIcon from '$lib/components/ui/ExclamationCircleIcon.svelte';
	import NavButton from '$lib/components/ui/NavButton.svelte';
	import { base } from '$app/paths';
</script>

<div class="flex flex-col items-center justify-center gap-6 py-12">
	<div class="text-center">
		<ExclamationCircleIcon size="size-16" class="text-warning mx-auto mb-4" />
		<h2 class="mb-2 text-2xl font-bold">No Data to Process</h2>
		<p class="text-base-content mb-6">Please upload a CSV file and validate it first.</p>
		<NavButton href="{base}/" label="Back to Validator" direction="back" />
	</div>
</div>
