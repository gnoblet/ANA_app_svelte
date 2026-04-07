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
 *     - flagger.ts (flagData) for threshold lookups and subfactor traversal
 *     - access_indicators.js helpers (getIndicatorMetadata, buildSubfactorList, etc.)
 *     - viz route for rendering labels and drilldown tables
 * - indicatorMap: flattened map keyed by uppercased indicator code (e.g. "IND001"),
 *   produced by flattenIndicators(). Used by:
 *     - validator.js (validateCsv) to check CSV column names
 *     - ValidationDisplay for display metadata
 * - generatedAt: ISO timestamp embedded in indicators.json at generation time.
 *   Used to detect when the server file has been updated and the cache should refresh.
 */
export interface IndicatorsState {
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

function persist(value: IndicatorsState): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	} catch (e) {
		console.warn('[indicatorsStore] Failed to persist to localStorage:', e);
	}
}

/**
 * Reactive indicators store (Svelte 5 runes).
 * Access fields directly: `indicatorsStore.indicatorsJson`, `indicatorsStore.indicatorMap`, etc.
 */
export const indicatorsStore = $state<IndicatorsState>(loadFromStorage());

export async function loadIndicatorsIntoStore(): Promise<void> {
	try {
		const json = await loadIndicators({ cache: 'no-cache' });
		const incoming = (json as Record<string, any>).generatedAt as string | undefined;
		if (incoming && incoming === indicatorsStore.generatedAt) return;
		const map = flattenIndicators(json);
		indicatorsStore.indicatorsJson = json;
		indicatorsStore.indicatorMap = map;
		indicatorsStore.generatedAt = incoming ?? null;
		persist($state.snapshot(indicatorsStore) as IndicatorsState);
	} catch (e) {
		console.error('[indicatorsStore] Failed to load indicators.json:', e);
	}
}
