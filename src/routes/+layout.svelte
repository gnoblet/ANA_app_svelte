<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Top navbar with Validator button -->
<div class="navbar bg-base-100 shadow-sm">
	<div class="flex-1">
		<a href="/" class="btn btn-ghost text-xl">ANA App</a>
	</div>

	<div class="flex-none">
		<!-- Validator page link -->
		<a href="/validator" class="btn btn-outline" aria-label="Validator page">Validator</a>
	</div>
</div>

{@render children()}
