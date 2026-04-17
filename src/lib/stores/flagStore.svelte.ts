import { browser } from '$app/environment';

const STORAGE_KEY = 'ana_flag_store_v2';

export interface FlagState {
	flaggedResult: Record<string, any>[] | null;
	uploadedAt: string | null;
	filename: string | null;
	metadataCols: string[];
}

const initialState: FlagState = {
	flaggedResult: null,
	uploadedAt: null,
	filename: null,
	metadataCols: []
};

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

function persist(value: FlagState): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	} catch (e) {
		console.warn('[flagStore] Failed to persist to localStorage:', e);
	}
}

/**
 * Reactive flag store (Svelte 5 runes).
 * Access fields directly: `flagStore.flaggedResult`, `flagStore.filename`, etc.
 * No `$` prefix needed — import and read as a plain object in components and .svelte.ts files.
 */
export const flagStore = $state<FlagState>(loadFromStorage());

export function setFlagResult(
	flaggedResult: Record<string, any>[],
	filename: string | null,
	metadataCols: string[] = []
): void {
	flagStore.flaggedResult = flaggedResult;
	flagStore.uploadedAt = new Date().toISOString();
	flagStore.filename = filename;
	flagStore.metadataCols = metadataCols;
	persist($state.snapshot(flagStore) as FlagState);
}

export function clearFlagResult(): void {
	flagStore.flaggedResult = initialState.flaggedResult;
	flagStore.uploadedAt = initialState.uploadedAt;
	flagStore.filename = initialState.filename;
	flagStore.metadataCols = initialState.metadataCols;
	if (browser) {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			// ignore
		}
	}
}
