"use client";

import { useCallback } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  DEFAULT_DISPLAY_SETTINGS,
  normalizeDisplaySettings,
  type DisplaySettings,
} from "@/lib/displaySettings";
import { STORAGE_KEYS } from "@/lib/storage";

export function useDisplaySettings(): [
  DisplaySettings,
  (value: DisplaySettings | ((current: DisplaySettings) => DisplaySettings)) => void,
  boolean,
] {
  const [rawSettings, setRawSettings, isHydrated] = useLocalStorage(
    STORAGE_KEYS.displaySettings,
    DEFAULT_DISPLAY_SETTINGS,
  );

  const settings = normalizeDisplaySettings(rawSettings);

  const setSettings = useCallback(
    (value: DisplaySettings | ((current: DisplaySettings) => DisplaySettings)) => {
      setRawSettings((current) => {
        const normalized = normalizeDisplaySettings(current);
        const next =
          typeof value === "function" ? value(normalized) : value;
        return normalizeDisplaySettings(next);
      });
    },
    [setRawSettings],
  );

  return [settings, setSettings, isHydrated];
}
