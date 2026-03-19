<script lang="ts">
	import { onMount } from 'svelte';
	import type { SvelteComponentTyped } from 'svelte';
	import type { Indicator } from '$lib/types/structure';

	// Concrete types that mirror the indicator structure embedded in the
	// circle-packing JSON. Using these gives better editor/TS feedback
	// when passing `data` to the CirclePacking component.

	// Minimal hierarchical node type for the circle-packing JSON.
	// We reuse the `Indicator` type from `src/lib/types/structure.ts` (imported above)
	// so there is no duplication of indicator/threshold types.
	type CircleNode = {
		name: string;
		children?: CircleNode[];
		value?: number;
		id?: string;
		// leaf nodes include the full Indicator object from the canonical types
		indicator?: Indicator;
	};

	// `data` is the root CircleNode (or null while loading).
	let data: CircleNode | null = null;

	// Typed CirclePacking component: props include `data: CircleNode`.
	let CirclePacking:
		| typeof SvelteComponentTyped<
				{ data: CircleNode },
				Record<string, unknown>,
				Record<string, unknown>
		  >
		| null = null;

	onMount(async () => {
		// Fetch the pre-generated circle-packing JSON from the static folder.
		const res = await fetch('/data/indicators-circlepacking.json');
		if (!res.ok) {
			console.error('Failed to load indicators-circlepacking.json', res.status);
			return;
		}
		// Cast to CircleNode; the file was produced by the generator and matches this shape.
		data = (await res.json()) as CircleNode;

		// Dynamically import the CirclePacking component and instantiate it
		// only after `data` is present so the component's initialization
		// (which computes the d3.pack() layout from the passed `data`)
		// runs with the correct payload.
		const mod = await import('$lib/components/viz/CirclePacking.svelte');
		CirclePacking = mod.default as typeof SvelteComponentTyped<
			{ data: CircleNode },
			Record<string, unknown>,
			Record<string, unknown>
		>;
	});
</script>

{#if CirclePacking && data}
	<svelte:component this={CirclePacking} {data} />
{:else}
	<p>Loading circle packing…</p>
{/if}
