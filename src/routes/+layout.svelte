<script lang="ts">
	import './layout.css';
	import logo from '$lib/assets/LogoANA2026.svg';
	import '../app.css';

	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	type AppRoute = Parameters<typeof resolve>[0];

	let { children } = $props();

	function isActive(path: AppRoute | string): boolean {
		const routeId = page.route.id ?? '';
		if (path === '/') return routeId === '/' || routeId === '';
		return routeId.startsWith(path);
	}

	const workflowLinks = [
		{ path: '/' as const, label: 'Home' },
		{ path: '/results' as const, label: 'Results' },
		{ path: '/detailed' as const, label: 'Detailed' },
		{ path: '/coverage' as const, label: 'Coverage' }
	];

	const utilityLinks = [
		{ path: '/download' as const, label: 'Downloads' },
		{ path: '/reference' as const, label: 'Reference' }
	];

	const allLinks = [...workflowLinks, ...utilityLinks];
</script>

<header class="bg-base-100 border-base-300 sticky top-0 z-30 border-b">
	<div class="navbar mx-auto min-h-14 max-w-7xl px-4">
		<!-- Brand -->
		<div class="navbar-start">
			<a
				href={resolve('/')}
				class="flex items-center gap-2.5"
				aria-label="ANA — Acute Needs Analysis"
			>
				<img src={logo} alt="ANA logo" class="h-8 w-auto shrink-0" />
				<span class="text-base-content/85 hidden font-semibold sm:inline">Acute Needs Analysis</span
				>
			</a>
		</div>

		<!-- Desktop nav -->
		<nav class="navbar-end hidden items-center gap-0 lg:flex" aria-label="Main navigation">
			<!-- Workflow links -->
			<div class="flex items-stretch">
				{#each workflowLinks as link (link.path)}
					<a
						href={resolve(link.path)}
						class={[
							'relative flex items-center px-3.5 py-1 text-base font-medium transition-colors duration-150',
							isActive(link.path)
								? 'text-primary after:bg-primary after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:rounded-full'
								: 'text-base-content/85 hover:text-base-content'
						].join(' ')}
						aria-current={isActive(link.path) ? 'page' : undefined}
					>
						{link.label}
					</a>
				{/each}
			</div>

			<!-- Divider -->
			<div class="bg-base-300 mx-3 h-5 w-px" aria-hidden="true"></div>

			<!-- Utility links -->
			<div class="flex items-center gap-1">
				{#each utilityLinks as link (link.path)}
					<a
						href={resolve(link.path)}
						class={[
							'rounded-md px-3 py-1.5 font-medium transition-colors duration-150',
							isActive(link.path)
								? 'bg-base-200 text-base-content'
								: 'text-base-content/85 hover:bg-base-200 hover:text-base-content'
						].join(' ')}
						aria-current={isActive(link.path) ? 'page' : undefined}
					>
						{link.label}
					</a>
				{/each}
			</div>

			<!-- Divider -->
			<div class="bg-base-300 mx-2 h-5 w-px" aria-hidden="true"></div>

			<!-- Theme toggle -->
			<ThemeToggle />
		</nav>

		<!-- Mobile: theme toggle + hamburger -->
		<div class="navbar-end flex items-center gap-1 lg:hidden">
			<ThemeToggle />
			<div class="dropdown dropdown-end">
				<button tabindex="0" aria-label="Open navigation menu" class="btn btn-ghost btn-sm">
					<svg
						aria-hidden="true"
						xmlns="http://www.w3.org/2000/svg"
						class="size-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
					</svg>
				</button>
				<ul
					tabindex="-1"
					class="menu menu-sm dropdown-content bg-base-100 border-base-300 rounded-box z-10 mt-2 w-52 border p-2 shadow-md"
				>
					{#each allLinks as link (link.path)}
						<li>
							<a
								href={resolve(link.path)}
								class={isActive(link.path) ? 'active' : ''}
								aria-current={isActive(link.path) ? 'page' : undefined}
							>
								{link.label}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
</header>

<main class="mx-auto max-w-6xl px-4 py-6">
	{@render children?.()}
</main>
