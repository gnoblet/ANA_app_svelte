<script lang="ts">
	type Variant = 'left' | 'right' | 'double-left' | 'double-right';

	interface Props {
		/** Which chevron to render */
		variant: Variant;
		/** Tailwind size class, e.g. "size-4", "size-6" */
		size?: string;
		/** SVG stroke-width */
		strokeWidth?: number;
		/** Additional classes on the <svg> element */
		class?: string;
	}

	let { variant, size = 'size-4', strokeWidth = 1.5, class: cls = '' }: Props = $props();

	const paths: Record<Variant, string> = {
		'left': 'M15.75 19.5 8.25 12l7.5-7.5',
		'right': 'm8.25 4.5 7.5 7.5-7.5 7.5',
		'double-left': 'm18.75 4.5-7.5 7.5 7.5 7.5m-6-15L5.25 12l7.5 7.5',
		'double-right': 'm5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5'
	};
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	fill="none"
	viewBox="0 0 24 24"
	stroke-width={strokeWidth}
	stroke="currentColor"
	class="{size} {cls}"
	aria-hidden="true"
>
	<path stroke-linecap="round" stroke-linejoin="round" d={paths[variant]} />
</svg>
