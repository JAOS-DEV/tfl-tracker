"use client";

import { useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { STORAGE_KEYS } from "@/lib/storage";
import { applyThemePreference, type ThemePreference } from "@/lib/theme";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({
  children,
}: ThemeProviderProps): React.ReactElement {
  const [theme, , isHydrated] = useLocalStorage<ThemePreference>(
    STORAGE_KEYS.theme,
    "system",
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    applyThemePreference(theme);
  }, [theme, isHydrated]);

  useEffect(() => {
    if (!isHydrated || theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyThemePreference("system");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, isHydrated]);

  return <>{children}</>;
}
