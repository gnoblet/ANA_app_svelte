<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { goto } from '$app/navigation';

	function navigateHome() {
		goto('/');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Simple navbar using DaisyUI/Tailwind -->
<nav class="navbar bg-base-100 shadow-sm">
	<div class="flex-1">
		<button onclick={navigateHome} class="btn btn-ghost text-xl normal-case">ANA App</button>
	</div>
</nav>

<main class="container mx-auto max-w-5xl p-4">
	<slot />
</main>
