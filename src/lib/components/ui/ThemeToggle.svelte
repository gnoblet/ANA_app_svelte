<script lang="ts">
	import { browser } from '$app/environment';

	const STORAGE_KEY = 'ana-theme';

	let isDark = $state(browser ? localStorage.getItem(STORAGE_KEY) !== 'ana-light' : true);

	function onchange(e: Event) {
		const checked = (e.target as HTMLInputElement).checked;
		isDark = checked;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, checked ? 'ana-dark' : 'ana-light');
		}
	}
</script>

<!--
  DaisyUI theme-controller: the checkbox value sets data-theme on <html>
  when checked. The swap classes animate the sun/moon icon swap.
-->
<label
	class="swap swap-rotate btn btn-ghost btn-sm btn-circle cursor-pointer"
	title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
	<input
		type="checkbox"
		class="theme-controller"
		value="ana-dark"
		checked={isDark}
		{onchange}
	/>

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
