<script lang="ts">
	interface Props {
		/** Tailwind size class, e.g. "size-4", "size-6" */
		size?: string;
		/** SVG stroke-width */
		strokeWidth?: number;
		/** Additional classes on the <svg> element */
		class?: string;
	}

	let { size = 'size-6', strokeWidth = 1.5, class: cls = '' }: Props = $props();
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
	<path
		stroke-linecap="round"
		stroke-linejoin="round"
		d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
	/>
</svg>
