<script lang="ts">
	import { resolve } from '$app/paths';
	import ValidatorView from '$lib/components/data/ValidatorView.svelte';
	import { validatorStore } from '$lib/stores/validatorStore.svelte';
	import type { ValidationResult } from '$lib/engine/validator';
</script>

<svelte:head>
	<title>ANA — Validation details</title>
</svelte:head>

<div class="mb-6 flex items-center gap-3">
	<a
		href={resolve('/')}
		class="btn btn-ghost btn-sm gap-1.5 cursor-pointer"
		aria-label="Back to upload"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="size-4"
			viewBox="0 0 20 20"
			fill="currentColor"
			aria-hidden="true"
		>
			<path
				fill-rule="evenodd"
				d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
				clip-rule="evenodd"
			/>
		</svg>
		Back to upload
	</a>
	<div class="bg-base-300 h-5 w-px" aria-hidden="true"></div>
	<h1 class="text-lg font-bold">Validation details</h1>
	{#if validatorStore.filename}
		<span class="text-base-content/45 text-sm">{validatorStore.filename}</span>
	{/if}
</div>

{#if validatorStore.validationResult}
	<ValidatorView
		result={validatorStore.validationResult as unknown as ValidationResult | null}
		header={validatorStore.lastHeader ?? []}
		rows={validatorStore.lastRows ?? []}
		loading={false}
	/>
{:else}
	<div class="card bg-base-100 border-base-300 border shadow-sm">
		<div class="card-body items-center py-16 text-center">
			<p class="text-base-content/50 text-sm">No validation result yet.</p>
			<a href={resolve('/')} class="btn btn-primary btn-sm mt-4 cursor-pointer">
				Upload a file
			</a>
		</div>
	</div>
{/if}
