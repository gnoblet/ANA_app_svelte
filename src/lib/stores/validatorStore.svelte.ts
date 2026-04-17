import { browser } from '$app/environment';

const STORAGE_KEY = 'ana_validator_store';

export interface ValidatorState {
	lastHeader: string[];
	lastRows: Record<string, unknown>[];
	validationResult: Record<string, unknown> | null;
	parseErrors: unknown | null;
	filename: string | null;
}

const initialState: ValidatorState = {
	lastHeader: [],
	lastRows: [],
	validationResult: null,
	parseErrors: null,
	filename: null
};

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

function persist(value: ValidatorState): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	} catch (e) {
		console.warn('[validatorStore] Failed to persist to localStorage:', e);
	}
}

/**
 * Reactive validator store (Svelte 5 runes).
 * Access fields directly: `validatorStore.lastHeader`, `validatorStore.validationResult`, etc.
 */
export const validatorStore = $state<ValidatorState>(loadFromStorage());

export function saveValidatorState(
	lastHeader: string[],
	lastRows: Record<string, unknown>[],
	validationResult: Record<string, unknown> | null,
	parseErrors: unknown | null,
	filename: string | null
): void {
	validatorStore.lastHeader = lastHeader;
	validatorStore.lastRows = lastRows;
	validatorStore.validationResult = validationResult;
	validatorStore.parseErrors = parseErrors;
	validatorStore.filename = filename;
	persist($state.snapshot(validatorStore) as ValidatorState);
}

export function clearValidatorState(): void {
	validatorStore.lastHeader = [];
	validatorStore.lastRows = [];
	validatorStore.validationResult = null;
	validatorStore.parseErrors = null;
	validatorStore.filename = null;
	if (browser) {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// ignore
		}
	}
}
