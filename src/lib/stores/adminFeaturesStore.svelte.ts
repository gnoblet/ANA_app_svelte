// src/lib/stores/adminFeaturesStore.svelte.ts
import { browser } from '$app/environment';

const STORAGE_KEY = 'ana_admin_features_store';

export type FetchState = 'idle' | 'loading' | 'done' | 'error';

export interface AdminFeaturesState {
  adm1: any | null;
  adm2: any | null;
  /** Identifies which country + level was last fetched, to avoid redundant requests. */
  cachedKey: string | null;
  fetchState: FetchState;
  fetchError: string | null;
}

const initialState: AdminFeaturesState = {
  adm1: null,
  adm2: null,
  cachedKey: null,
  fetchState: 'idle',
  fetchError: null
};

function loadFromStorage(): AdminFeaturesState {
  if (!browser) return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as AdminFeaturesState;
    // Restore meaningful states: done (has data), error (lookup failed), idle (otherwise).
    // 'loading' is never persisted — it's always transient.
    const fetchState: FetchState = parsed.adm1
      ? 'done'
      : parsed.fetchState === 'error'
        ? 'error'
        : 'idle';
    return { ...parsed, fetchState, fetchError: fetchState === 'error' ? parsed.fetchError : null };
  } catch {
    return initialState;
  }
}

function persist(value: AdminFeaturesState): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (e) {
    console.warn('[adminFeaturesStore] Failed to persist to localStorage:', e);
  }
}

export const adminFeaturesStore = $state<AdminFeaturesState>(loadFromStorage());

export function setAdminFeatures(adm1: any, adm2: any, key: string) {
  adminFeaturesStore.adm1 = adm1;
  adminFeaturesStore.adm2 = adm2;
  adminFeaturesStore.cachedKey = key;
  adminFeaturesStore.fetchState = 'done';
  adminFeaturesStore.fetchError = null;
  persist($state.snapshot(adminFeaturesStore) as AdminFeaturesState);
}

export function setAdminFetchState(state: FetchState, error?: string) {
  adminFeaturesStore.fetchState = state;
  adminFeaturesStore.fetchError = error ?? null;
  // Persist error state so reload doesn't retry a known-bad pcode.
  if (state === 'error') {
    persist($state.snapshot(adminFeaturesStore) as AdminFeaturesState);
  }
}

export function clearAdminFeatures() {
  adminFeaturesStore.adm1 = null;
  adminFeaturesStore.adm2 = null;
  adminFeaturesStore.cachedKey = null;
  adminFeaturesStore.fetchState = 'idle';
  adminFeaturesStore.fetchError = null;
  if (browser) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}