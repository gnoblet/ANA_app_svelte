<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	// Navbar
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	// Check if the link is active
	function isActive(path: string): boolean {
		const routeId = page.route.id ?? '';
		if (path === '/') {
			return routeId === '/' || routeId === '';
		}
		return routeId.startsWith(path);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Navbar -->
<div class="navbar bg-primary text-base-100 shadow-md">
	<div class="navbar-start">
		<a href={resolve('/')} class="btn btn-ghost text-xl">ANA App</a>
	</div>

	<!-- Desktop: right-aligned nav links / Mobile: hamburger -->
	<div class="navbar-end gap-1">
		<!-- Desktop buttons -->
		<div class="hidden gap-1 lg:flex">
			<a href={resolve('/')} class="btn btn-ghost" class:btn-active={isActive('/')}>Home</a>
			<a href={resolve('/viz')} class="btn btn-ghost" class:btn-active={isActive('/viz')}>Results</a
			>
			<a
				href={resolve('/detailed-viz')}
				class="btn btn-ghost"
				class:btn-active={isActive('/detailed-viz')}>Detailed Results</a
			>
			<a
				href={resolve('/circle-packing-inputs')}
				class="btn btn-ghost"
				class:btn-active={isActive('/circle-packing-inputs')}>Inputs Map</a
			>
			<a
				href={resolve('/circle-packing')}
				class="btn btn-ghost"
				class:btn-active={isActive('/circle-packing')}>Reference List</a
			>
		</div>
		<!-- Mobile: hamburger dropdown -->
		<div class="dropdown dropdown-end lg:hidden">
			<div tabindex="0" role="button" class="btn">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h8m-8 6h16"
					/>
				</svg>
			</div>
			<ul
				tabindex="-1"
				class="menu menu-md dropdown-content bg-base-200 rounded-box z-[10] mt-3 w-52 p-2 shadow"
			>
				<li><a href={resolve('/')} class:active={isActive('/')}>Home</a></li>
				<li><a href={resolve('/viz')} class:active={isActive('/viz')}>Results</a></li>
				<li>
					<a href={resolve('/detailed-viz')} class:active={isActive('/detailed-viz')}
						>Detailed Results</a
					>
				</li>
				<li>
					<a
						href={resolve('/circle-packing-inputs')}
						class:active={isActive('/circle-packing-inputs')}
					>
						Inputs Map
					</a>
				</li>
				<li>
					<a href={resolve('/circle-packing')} class:active={isActive('/circle-packing')}
						>Reference List</a
					>
				</li>
			</ul>
		</div>
	</div>
</div>

<main class="container mx-auto max-w-5xl p-4">
	<slot />
</main>
