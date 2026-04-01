<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { children } = $props();

	function isActive(path: string): boolean {
		const routeId = page.route.id ?? '';
		if (path === '/') return routeId === '/' || routeId === '';
		return routeId.startsWith(path);
	}

	const navLinks = [
		{ href: '/', label: 'Home' },
		{ href: '/viz', label: 'Results' },
		{ href: '/detailed-viz', label: 'Detailed Results' },
		{ href: '/circle-packing-inputs', label: 'Inputs Map' },
		{ href: '/circle-packing', label: 'Reference List' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="bg-base-100 border-base-300 sticky top-0 z-30 border-b shadow-sm">
	<div class="navbar mx-auto max-w-7xl px-4">
		<div class="navbar-start">
			<a href={resolve('/')} class="text-base-content text-lg font-semibold tracking-tight">
				ANA App
			</a>
		</div>

		<nav class="navbar-end gap-0.5">
			<!-- Desktop -->
			<div class="hidden items-center gap-0.5 lg:flex">
				{#each navLinks as link (link.href)}
					<a
						href={resolve(link.href)}
						class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {isActive(link.href) ? 'bg-base-200 text-primary' : 'text-base-content hover:bg-base-200/60'}"
					>{link.label}</a>
				{/each}
			</div>

			<!-- Mobile hamburger -->
			<div class="dropdown dropdown-end lg:hidden">
				<button tabindex="0" aria-label="Open navigation menu" class="btn btn-ghost btn-sm">
					<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
					</svg>
				</button>
				<ul tabindex="-1" class="menu menu-sm dropdown-content bg-base-100 border-base-300 rounded-box z-10 mt-2 w-48 border p-2 shadow-md">
					{#each navLinks as link (link.href)}
						<li>
							<a href={resolve(link.href)} class:active={isActive(link.href)}>{link.label}</a>
						</li>
					{/each}
				</ul>
			</div>
		</nav>
	</div>
</header>

<main class="mx-auto max-w-7xl px-4 py-6">
	{@render children?.()}
</main>
