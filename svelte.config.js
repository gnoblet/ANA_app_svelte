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
		// This optimizes the initial page load and improves SEO
		prerender: {
			entries: ['/', '/flag']
		}
	}
};

export default config;
