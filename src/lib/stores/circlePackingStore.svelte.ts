/**
 * Module-level singleton that caches the indicators-circlepacking.json tree data.
 *
 * Storing this at module level (rather than as component-local `$state`) means the data
 * persists across client-side navigations. The JSON is fetched at most once per browser
 * session: subsequent visits to pages that use this store skip the network request and
 * render immediately.
 *
 * Pattern: exported as a `$state` object so consumers can read reactive properties
 * (`circlePackingStore.data`, `.loading`, `.error`) without directly reassigning them —
 * only `loadCirclePackingData()` mutates the object.
 */
export const circlePackingStore = $state<{
	data: unknown;
	error: string | null;
	loading: boolean;
}>({
	data: null,
	error: null,
	loading: false
});

let fetched = false;

export async function loadCirclePackingData(url: string): Promise<void> {
	if (fetched) return;
	circlePackingStore.loading = true;
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
		circlePackingStore.data = await res.json();
		fetched = true;
	} catch (e: unknown) {
		circlePackingStore.error = e instanceof Error ? e.message : String(e);
		fetched = true; // don't retry on error
	} finally {
		circlePackingStore.loading = false;
	}
}
