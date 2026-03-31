// src/lib/stores/adminFeaturesStore.svelte.ts
import { browser } from '$app/environment';

const STORAGE_KEY = 'ana_admin_features_store';

export interface AdminFeaturesState {
  adm1: any | null;
  adm2: any | null;
}

const initialState: AdminFeaturesState = {
  adm1: null,
  adm2: null
};

function loadFromStorage(): AdminFeaturesState {
  if (!browser) return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    return JSON.parse(raw) as AdminFeaturesState;
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

export function setAdminFeatures(adm1: any, adm2: any) {
  adminFeaturesStore.adm1 = adm1;
  adminFeaturesStore.adm2 = adm2;
  persist($state.snapshot(adminFeaturesStore) as AdminFeaturesState);
}

export function clearAdminFeatures() {
  adminFeaturesStore.adm1 = null;
  adminFeaturesStore.adm2 = null;
  if (browser) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}