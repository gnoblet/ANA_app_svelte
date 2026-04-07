import { browser } from '$app/environment';
import { asset } from '$app/paths';

/* --------------------- Indicator types --------------------- */

export type IndicatorEntry = {
	indicator: string;
	type: string | null;
	indicator_label: string | null;
	metric: string | null;
	raw: unknown;
};

/* --------------------- Fetch + flatten --------------------- */

async function loadIndicators(init?: RequestInit): Promise<unknown> {
	const url = asset('/data/indicators.json');
	const res = await fetch(url, init);
	if (!res.ok) throw new Error(`Failed to fetch indicators JSON: ${res.status}`);
	return res.json();
}

function register(ind: unknown, map: Record<string, IndicatorEntry>): void {
	if (!ind || typeof ind !== 'object') return;
	const i = ind as Record<string, unknown>;
	if (!i['indicator']) return;
	const key = String(i['indicator']).trim().toUpperCase();
	if (!key) return;
	map[key] = {
		indicator: key,
		type: typeof i['type'] === 'string' ? i['type'] : null,
		indicator_label: typeof i['indicator_label'] === 'string' ? i['indicator_label'] : null,
		metric: typeof i['metric'] === 'string' ? i['metric'] : null,
		raw: ind
	};
}

function flattenIndicators(json: unknown): Record<string, IndicatorEntry> {
	const map: Record<string, IndicatorEntry> = Object.create(null);
	if (!json || typeof json !== 'object') return map;
	const j = json as Record<string, unknown>;
	if (!Array.isArray(j['systems'])) return map;

	for (const system of j['systems']) {
		if (!system || typeof system !== 'object') continue;
		const s = system as Record<string, unknown>;
		const factors = Array.isArray(s['factors']) ? s['factors'] : [];
		for (const factor of factors) {
			if (!factor || typeof factor !== 'object') continue;
			const f = factor as Record<string, unknown>;
			if (Array.isArray(f['indicators'])) {
				for (const ind of f['indicators']) register(ind, map);
			}
			const subs = Array.isArray(f['sub_factors']) ? f['sub_factors'] : [];
			for (const sub of subs) {
				if (!sub || typeof sub !== 'object') continue;
				const sf = sub as Record<string, unknown>;
				if (!Array.isArray(sf['indicators'])) continue;
				for (const ind of sf['indicators']) register(ind, map);
			}
		}
	}

	return map;
}

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
