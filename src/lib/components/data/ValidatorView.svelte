<script lang="ts">
	import ValidationDisplay from '$lib/components/data/ValidationDisplay.svelte';
	import type { ValidationResult } from '$lib/processing/validator';

	interface Props {
		result: ValidationResult | null;
		header: string[];
		rows: Record<string, unknown>[];
		loading: boolean;
	}

	let { result, header, rows, loading }: Props = $props();
</script>

<div class="card w-full">
	<div class="card-body">
		<h3 class="card-title">Validation result</h3>
		<ValidationDisplay {result} {header} {rows} {loading} />
	</div>
</div>
