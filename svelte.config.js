import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Configure the static adapter for deploying to GitHub Pages
		adapter: adapter({
			// fallback: 'index.html' ensures that all unmatched routes are served index.html
			// This allows client-side routing to work properly in a Single Page Application (SPA)
			// Without this, navigating to /flag directly would result in a 404
			fallback: 'index.html',

			// strict: false disables the strict mode error that prevents dynamic routes from being built
			// Since this is a client-side SPA that uses sessionStorage for state management,
			// the routes don't need to be pre-rendered at build time - they work entirely in the browser
			// Set to true if you want SvelteKit to error on any dynamic routes (safer but stricter)
			strict: false
		}),

		// prerender: explicitly tells SvelteKit which routes to pre-render as static HTML files
		// entries: ['/', '/flag'] means both the homepage and flag page will be generated as static files
		// The /flag page is pre-rendered with an empty/placeholder state, then dynamically updated
		// when users navigate to it with data in sessionStorage (via onMount hook)
		prerender: {
			entries: ['/', '/flag'],
			handleHttpError: ({ path, referrer, message }) => {
				// Ignore errors about paths not beginning with base - this is expected for prerender
				if (message.includes('does not begin with `base`')) {
					return;
				}
				// Otherwise fail the build
				throw new Error(message);
			}
		},

		// paths.base: Set the base path for /ANA_app_svelte deployment
		// Even with custom domain (guillaume-noblet.com), the app is still served from /ANA_app_svelte/
		// This tells SvelteKit to prefix all routes and asset paths with '/ANA_app_svelte'
		paths: {
			base: '/ANA_app_svelte'
		}
	}
};

export default config;
