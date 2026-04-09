<script lang="ts">
	import { setContext } from 'svelte';
	import Group from './Group.svelte';
	import type { Snippet } from 'svelte';

	export interface Dimensions {
		width: number;
		height: number;
		margins: { top: number; right: number; bottom: number; left: number };
		innerWidth: number;
		innerHeight: number;
	}

	interface Props {
		dimensions?: Dimensions;
		/** SVG overflow attribute — set to "visible" when chart elements (e.g. hover arcs) extend beyond SVG bounds. */
		overflow?: 'visible' | 'hidden';
		children?: Snippet;
	}

	let {
		dimensions = {
			width: 100,
			height: 100,
			margins: { top: 0, right: 0, bottom: 0, left: 0 },
			innerWidth: 100,
			innerHeight: 100
		},
		overflow = 'hidden',
		children
	}: Props = $props();

	// Getter-based context — children read the current reactive value of dimensions,
	// no writable store needed (unlike Svelte 4 upstream).
	setContext('Chart', {
		get dimensions() {
			return dimensions;
		}
	});
</script>

<svg class="Chart" width={dimensions.width} height={dimensions.height} {overflow} style="display:block">
	<Group left={dimensions.margins.left} top={dimensions.margins.top}>
		{@render children?.()}
	</Group>
</svg>
