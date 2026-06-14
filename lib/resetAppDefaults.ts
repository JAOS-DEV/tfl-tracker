import { DEFAULT_DISPLAY_SETTINGS } from "@/lib/displaySettings";
import { clearAllRouteHistory } from "@/lib/localRouteHistory";
import { STORAGE_KEYS, writeJsonStorage } from "@/lib/storage";
import { applyThemePreference } from "@/lib/theme";

export const LOCAL_STORAGE_CHANGE_EVENT = "tfl-tracker:storage";

export function resetAppToDefaults(): void {
  if (typeof window === "undefined") {
    return;
  }

  writeJsonStorage(STORAGE_KEYS.activeRoutes, []);
  writeJsonStorage(STORAGE_KEYS.recentRoutes, []);
  writeJsonStorage(STORAGE_KEYS.favouriteRoutes, []);
  writeJsonStorage(STORAGE_KEYS.favouriteStops, []);
  writeJsonStorage(STORAGE_KEYS.routeAlertPreferences, {});
  writeJsonStorage(STORAGE_KEYS.displaySettings, DEFAULT_DISPLAY_SETTINGS);
  writeJsonStorage(STORAGE_KEYS.theme, "system");
  window.localStorage.removeItem(STORAGE_KEYS.installBannerDismissed);
  clearAllRouteHistory();
  applyThemePreference("system");
  window.dispatchEvent(new Event(LOCAL_STORAGE_CHANGE_EVENT));
}
