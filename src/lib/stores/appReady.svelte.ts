/**
 * A module-level singleton that tracks whether the client-side app has completed its
 * initial hydration and store check.
 *
 * Starts as `false` — even in the browser — so that pages guarded by DataGuard can
 * briefly show a "checking for stored data" state before revealing content or NoDataState.
 *
 * `setAppReady()` flips it to `true`. DataGuard calls this in its first `$effect`, which
 * runs after the first DOM update on mount. Because this is module-level `$state`, it stays
 * `true` for the rest of the browser session: the loading state only appears once (on first
 * navigation to a guarded page), never on subsequent client-side route changes.
 *
 * During SSR / prerender the value remains `false` — guards suppress their content,
 * preventing hydration mismatches.
 */
// Object wrapper required by Svelte 5: exported $state primitives cannot be
// reassigned — only object properties can be mutated from a setter function.
export const appReady = $state({ ready: false });

export function setAppReady(): void {
	appReady.ready = true;
}
