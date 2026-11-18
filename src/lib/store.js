// App-wide singleton store + React bindings.
import { createContext, useContext, useSyncExternalStore } from 'react';
import { createStore } from './storage.js';

function browserStorage() {
  try {
    const s = window.localStorage;
    const probe = '__clatgk_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return undefined; // private mode / blocked: in-memory only
  }
}

export const store = createStore(browserStorage());
export const storageAvailable = !!browserStorage();

export function useAppState() {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

// Question bank (loaded once in App) shared through context.
export const BankContext = createContext(null);
export function useBank() {
  return useContext(BankContext);
}
