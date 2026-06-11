"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { readJsonStorage, writeJsonStorage } from "@/lib/storage";

const STORAGE_EVENT = "tfl-tracker:storage";

interface SnapshotCacheEntry {
  raw: string | null;
  value: unknown;
}

const snapshotCache = new Map<string, SnapshotCacheEntry>();

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function getSnapshot<T>(key: string, initialValue: T): T {
  const raw = window.localStorage.getItem(key);
  const cached = snapshotCache.get(key);

  if (cached && cached.raw === raw) {
    return cached.value as T;
  }

  const value = raw === null ? initialValue : readJsonStorage(key, initialValue);
  snapshotCache.set(key, { raw, value });
  return value;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((current: T) => T)) => void, boolean] {
  const initialValueRef = useRef(initialValue);

  const getSnapshotForKey = useCallback(
    () => getSnapshot(key, initialValueRef.current),
    [key],
  );

  const storedValue = useSyncExternalStore(
    subscribe,
    getSnapshotForKey,
    () => initialValueRef.current,
  );

  const isHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const setValue = useCallback(
    (value: T | ((current: T) => T)) => {
      const current = getSnapshot(key, initialValueRef.current);
      const nextValue =
        typeof value === "function"
          ? (value as (currentValue: T) => T)(current)
          : value;
      const raw = JSON.stringify(nextValue);

      writeJsonStorage(key, nextValue);
      snapshotCache.set(key, { raw, value: nextValue });
      window.dispatchEvent(new Event(STORAGE_EVENT));
    },
    [key],
  );

  return [storedValue, setValue, isHydrated];
}
