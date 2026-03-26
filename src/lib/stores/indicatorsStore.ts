import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { loadIndicators, flattenIndicators } from '$lib/processing/indicators.js';

/**
 * localStorage key used to persist the indicators store across sessions.
 * Changing this key will invalidate any previously stored data.
 */
const STORAGE_KEY = 'ana_indicators_store';

/**
 * Shape of the indicators store state.
 *
 * - indicatorsJson: the full parsed indicators.json object, used by:
 *     - flagger.js (flagData) for threshold lookups and subfactor traversal
 *     - access_indicators.js helpers (getIndicatorMetadata, buildSubfactorList, etc.)
 *     - viz route for rendering labels and drilldown tables
 * - indicatorMap: flattened map keyed by uppercased indicator code (e.g. "IND001"),
 *   produced by flattenIndicators(). Used by:
 *     - validator.js (validateCsv) to check CSV column names
 *     - ValidationDisplay for display metadata
 * - generatedAt: ISO timestamp embedded in indicators.json at generation time.
 *   Used to detect when the server file has been updated and the cache should refresh.
 */
interface IndicatorsState {
	indicatorsJson: Record<string, any> | null;
	indicatorMap: Record<string, any>;
	generatedAt: string | null;
}

/**
 * Empty state — used on first load before fetch completes.
 */
const initialState: IndicatorsState = {
	indicatorsJson: null,
	indicatorMap: {},
	generatedAt: null
};

/**
 * Attempt to rehydrate the store from localStorage on module load.
 * Returns initialState if:
 *  - We are running on the server (SSR) — localStorage is not available.
 *  - Nothing is stored under STORAGE_KEY yet.
 *  - The stored value is malformed JSON.
 */
function loadFromStorage(): IndicatorsState {
	if (!browser) return initialState;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return initialState;
		return JSON.parse(raw) as IndicatorsState;
	} catch {
		return initialState;
	}
}

/**
 * The central indicators store.
 *
 * Initialised from localStorage (if available) so subsequent visits do not
 * need to re-fetch indicators.json.
 *
 * Components subscribe with the $indicatorsStore rune:
 *   const indicatorsJson = $derived($indicatorsStore.indicatorsJson);
 *   const indicatorMap  = $derived($indicatorsStore.indicatorMap);
 */
export const indicatorsStore = writable<IndicatorsState>(loadFromStorage());

/**
 * Auto-persist every store update to localStorage.
 * Guarded by `browser` so this never runs during SSR.
 * Catches QuotaExceededError (and other storage errors) with a warning
 * rather than crashing — the app continues to work, just without persistence.
 */
if (browser) {
	indicatorsStore.subscribe((value) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
		} catch (e) {
			console.warn('[indicatorsStore] Failed to persist to localStorage:', e);
		}
	});
}

/**
 * Fetch indicators.json, compute the flattened indicatorMap, and write
 * both into the store (and therefore localStorage).
 *
 * Always fetches with `cache: 'no-cache'` so the browser never serves a
 * stale response. The store is only updated when the `generatedAt` timestamp
 * embedded in the JSON differs from the one already in localStorage, meaning
 * clients automatically pick up indicator updates without manual cache clearing.
 *
 * Should be called once at app initialisation, e.g. in +layout.svelte.
 */
export async function loadIndicatorsIntoStore(): Promise<void> {
	// Read current value without subscribing
	let current: IndicatorsState = initialState;
	const unsub = indicatorsStore.subscribe((v) => (current = v));
	unsub();

	try {
		const json = await loadIndicators({ cache: 'no-cache' });
		const incoming = (json as Record<string, any>).generatedAt as string | undefined;
		if (incoming && incoming === current.generatedAt) return;
		const map = flattenIndicators(json);
		indicatorsStore.set({
			indicatorsJson: json,
			indicatorMap: map,
			generatedAt: incoming ?? null
		});
	} catch (e) {
		console.error('[indicatorsStore] Failed to load indicators.json:', e);
	}
}
