<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	// Navbar
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	// Check if the link is active
	function isActive(path: string): boolean {
		// Remove base from pathname for comparison
		const pathname = $page.url.pathname.startsWith(base)
			? $page.url.pathname.slice(base.length)
			: $page.url.pathname;

		if (path === '/') {
			return pathname === '/' || pathname === '';
		}
		return pathname.startsWith(path);
	}

	function goHome() {
		// Dispatch custom event to reset the view state
		window.dispatchEvent(new CustomEvent('resetView'));
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Simple navbar using DaisyUI/Tailwind -->
<nav class="navbar bg-base-100 sticky top-0 z-50 shadow-lg">
	<div class="navbar-start">
		<a href="{base}/" class="btn btn-ghost text-xl normal-case">ANA App</a>
	</div>

	<div class="navbar-end gap-4">
		<!-- Desktop Navigation Buttons (visible on large screens) -->
		<div class="hidden gap-2 lg:flex">
			<button class="btn btn-ghost" class:btn-active={isActive('/')} onclick={goHome}>
				Home
			</button>
			<a href="{base}/viz" class="btn btn-ghost" class:btn-active={isActive('/viz')}> Results </a>
		</div>
	</div>
</nav>

<main class="container mx-auto max-w-5xl p-4">
	<slot />
</main>
