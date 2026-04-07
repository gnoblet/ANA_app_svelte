import { browser } from '$app/environment';

/**
 * A module-level singleton that tracks whether the app is running in the browser.
 *
 * Initialized with `browser` from `$app/environment`:
 * - `false` during SSR/prerender (localStorage is unavailable, stores hold initialState)
 * - `true` always on the client — including on every client-side navigation
 *
 * Because this is a module-level `$state` in a `.svelte.ts` file, it is shared across
 * all component instances and persists for the lifetime of the browser session. It never
 * resets between route changes, unlike component-local `$state`.
 *
 * Usage: guards like DataGuard read `appReady` instead of a local `mounted` flag so that
 * the loading spinner only appears once (during the initial SSR → client hydration), never
 * on subsequent client-side navigations where the stores are already populated.
 */
export let appReady = $state(browser);
