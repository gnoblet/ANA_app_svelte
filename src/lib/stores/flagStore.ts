import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * localStorage key used to persist the flag store across sessions.
 * Changing this key will invalidate any previously stored data.
 */
const STORAGE_KEY = 'ana_flag_store';

/**
 * Shape of the flag store state.
 *
 * - flaggedResult: the output rows from flagData() — one object per UOA,
 *   containing indicator values, _flag, _flag_label, _within_10perc,
 *   _within_10perc_change, and subfactor/factor/system aggregate counts.
 * - uploadedAt: ISO timestamp of the last flagging run, used to show
 *   "processed at <date>" in the viz route.
 * - filename: original uploaded CSV filename, shown in the viz route header.
 *
 * Note: indicatorsJson is NOT stored here — it lives in indicatorsStore,
 * which is the single source of truth for indicators metadata.
 */
interface FlagState {
	flaggedResult: Record<string, any>[] | null;
	uploadedAt: string | null;
	filename: string | null;
	metadataCols: string[];
}

/**
 * Empty state — used on first load and after clearFlagResult().
 */
const initialState: FlagState = {
	flaggedResult: null,
	uploadedAt: null,
	filename: null,
	metadataCols: []
};

/**
 * Attempt to rehydrate the store from localStorage on module load.
 * Returns initialState if:
 *  - We are running on the server (SSR) — localStorage is not available.
 *  - Nothing is stored under STORAGE_KEY yet.
 *  - The stored value is malformed JSON.
 */
function loadFromStorage(): FlagState {
	if (!browser) return initialState;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return initialState;
		return JSON.parse(raw) as FlagState;
	} catch {
		return initialState;
	}
}

/**
 * The central flag store.
 *
 * Initialised from localStorage (if available) so data persists across
 * page reloads and browser sessions.
 *
 * Components subscribe with the $flagStore rune:
 *   const flagged = $derived($flagStore.flaggedResult ?? []);
 */
export const flagStore = writable<FlagState>(loadFromStorage());

/**
 * Auto-persist every store update to localStorage.
 * Guarded by `browser` so this never runs during SSR.
 * Catches QuotaExceededError (and other storage errors) with a warning
 * rather than crashing — the app continues to work, just without persistence.
 */
if (browser) {
	flagStore.subscribe((value) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
		} catch (e) {
			console.warn('[flagStore] Failed to persist to localStorage:', e);
		}
	});
}

/**
 * Save a completed flagging run to the store (and therefore localStorage).
 *
 * Called by FlagView.svelte immediately after flagData() returns successfully.
 *
 * @param flaggedResult - output of flagData(): one row per UOA with all
 *   computed flag and aggregate columns.
 * @param filename - original uploaded CSV filename, or null if unknown.
 */
export function setFlagResult(
	flaggedResult: Record<string, any>[],
	filename: string | null,
	metadataCols: string[] = []
): void {
	flagStore.set({
		flaggedResult,
		uploadedAt: new Date().toISOString(),
		filename,
		metadataCols
	});
}

/**
 * Reset the store to its empty state and remove the persisted entry from
 * localStorage. Useful for a "clear / start over" action in the UI.
 */
export function clearFlagResult(): void {
	flagStore.set(initialState);
	if (browser) {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// ignore — if removal fails the worst outcome is stale data on next load
		}
	}
}
