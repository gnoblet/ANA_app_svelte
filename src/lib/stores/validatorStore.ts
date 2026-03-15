import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * localStorage key used to persist the validator store across sessions.
 * Changing this key will invalidate any previously stored data.
 */
const STORAGE_KEY = 'ana_validator_store';

/**
 * Shape of the validator store state.
 *
 * - lastHeader: the parsed CSV header row (array of column name strings).
 * - lastRows: the raw parsed rows as string values, before numeric coercion.
 * - validationResult: the result object returned by validateCsv(), including
 *   ok status, errors, warnings, and the coerced numericObjects array.
 * - parseErrors: any errors thrown during CSV parsing (before validation).
 * - filename: original uploaded CSV filename, shown in the UI.
 */
interface ValidatorState {
	lastHeader: string[];
	lastRows: Record<string, unknown>[];
	validationResult: Record<string, unknown> | null;
	parseErrors: unknown | null;
	filename: string | null;
}

/**
 * Empty state — used on first load and after clearValidatorState().
 */
const initialState: ValidatorState = {
	lastHeader: [],
	lastRows: [],
	validationResult: null,
	parseErrors: null,
	filename: null
};

/**
 * Attempt to rehydrate the store from localStorage on module load.
 * Returns initialState if:
 *  - We are running on the server (SSR) — localStorage is not available.
 *  - Nothing is stored under STORAGE_KEY yet.
 *  - The stored value is malformed JSON.
 */
function loadFromStorage(): ValidatorState {
	if (!browser) return initialState;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return initialState;
		return JSON.parse(raw) as ValidatorState;
	} catch {
		return initialState;
	}
}

/**
 * The central validator store.
 *
 * Initialised from localStorage (if available) so the last uploaded file
 * and validation result survive page reloads and browser sessions.
 *
 * Components subscribe with the $validatorStore rune:
 *   const header = $derived($validatorStore.lastHeader);
 */
export const validatorStore = writable<ValidatorState>(loadFromStorage());

/**
 * Auto-persist every store update to localStorage.
 * Guarded by `browser` so this never runs during SSR.
 * Catches QuotaExceededError (and other storage errors) with a warning
 * rather than crashing — the app continues to work, just without persistence.
 */
if (browser) {
	validatorStore.subscribe((value) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
		} catch (e) {
			console.warn('[validatorStore] Failed to persist to localStorage:', e);
		}
	});
}

/**
 * Save the current validator state to the store (and therefore localStorage).
 *
 * Called by ValidatorView.svelte after each successful parse + validation run.
 *
 * @param lastHeader - parsed CSV header row.
 * @param lastRows - raw parsed rows (string values).
 * @param validationResult - result returned by validateCsv().
 * @param parseErrors - any CSV parse errors, or null if none.
 * @param filename - original uploaded CSV filename, or null if unknown.
 */
export function saveValidatorState(
	lastHeader: string[],
	lastRows: Record<string, unknown>[],
	validationResult: Record<string, unknown> | null,
	parseErrors: unknown | null,
	filename: string | null
): void {
	validatorStore.set({
		lastHeader,
		lastRows,
		validationResult,
		parseErrors,
		filename
	});
}

/**
 * Reset the store to its empty state and remove the persisted entry from
 * localStorage. Called when:
 *  - The user clicks "Clear" in the uploader.
 *  - The user clicks "Let's Flag" — validator state is handed off to the
 *    flagger and no longer needs to persist.
 */
export function clearValidatorState(): void {
	validatorStore.set(initialState);
	if (browser) {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// ignore — if removal fails the worst outcome is stale data on next load
		}
	}
}
