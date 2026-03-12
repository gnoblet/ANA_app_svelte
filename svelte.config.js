import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.argv.includes('dev');

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-static configuration for GitHub Pages
		adapter: adapter({
			// default options are shown. On some platforms
			// these options are set automatically — see below
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),

		// paths.base: Use environment variable for base path
		// On localhost (dev): no base path needed
		// On production: BASE_PATH environment variable set by GitHub Actions workflow
		// This approach matches the swiss-jails repo and works for any repository name
		paths: {
			base: process.argv.includes('dev') ? '' : ''
		}
	}
};

export default config;
