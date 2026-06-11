import { STORAGE_KEYS } from "@/lib/storage";

export type ThemePreference = "light" | "dark" | "system";

export function resolveIsDark(
  theme: ThemePreference,
  prefersDark: boolean,
): boolean {
  return theme === "dark" || (theme === "system" && prefersDark);
}

export function readThemePreference(
  raw: string | null,
  fallback: ThemePreference = "system",
): ThemePreference {
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === "light" || parsed === "dark" || parsed === "system") {
      return parsed;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function applyThemePreference(theme: ThemePreference): void {
  if (typeof document === "undefined") {
    return;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle(
    "dark",
    resolveIsDark(theme, prefersDark),
  );
}

export const themeInitScript = `(function(){try{var raw=localStorage.getItem("${STORAGE_KEYS.theme}");var theme=raw?JSON.parse(raw):"system";var isDark=theme==="dark"||(theme==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",isDark);}catch(e){}})();`;
