<script lang="ts">
	import { browser } from '$app/environment';

	const STORAGE_KEY = 'ana-theme';

	let isDark = $state(browser ? localStorage.getItem(STORAGE_KEY) !== 'ana-light' : true);

	function onchange(e: Event) {
		const checked = (e.target as HTMLInputElement).checked;
		isDark = checked;
		if (browser) {
			const theme = checked ? 'ana-dark' : 'ana-light';
			localStorage.setItem(STORAGE_KEY, theme);
			// Drive data-theme directly — do NOT rely on DaisyUI's theme-controller
			// CSS :has() selector, which conflicts with our manually-set attribute.
			document.documentElement.setAttribute('data-theme', theme);
		}
	}
</script>

<!--
  swap-rotate drives the sun/moon animation via checkbox checked state.
  No theme-controller class — we set data-theme explicitly in onchange.
  Input is sr-only so it doesn't show browser default checkbox styling.
-->
<label
	// class="swap swap-rotate inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-base-content/60 hover:bg-base-300/60 hover:text-base-content transition-colors duration-150"
	class="swap swap-rotate btn btn-ghost btn-sm btn-circle hover:bg-base-300"
	title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
	<input type="checkbox" checked={isDark} {onchange} class="sr-only" />

	<!-- Sun — shown when light mode (swap-off = unchecked) -->
	<svg
		class="swap-off size-4"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="4" />
		<path
			d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
		/>
	</svg>

	<!-- Moon — shown when dark mode (swap-on = checked) -->
	<svg
		class="swap-on size-4"
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
	</svg>
</label>
