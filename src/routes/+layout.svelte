<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Simple navbar using DaisyUI/Tailwind -->
<nav class="navbar bg-base-100 shadow-sm">
	<div class="flex-1">
		<a href="/" class="btn btn-ghost text-xl normal-case">ANA App</a>
	</div>

	<div class="flex-none">
		<a href="/validator" class="btn btn-primary btn-sm" aria-label="Open Validator">Validator</a>
	</div>
</nav>

<main class="container mx-auto max-w-5xl p-4">
	<slot />
</main>
