"use client";

import { useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { STORAGE_KEYS } from "@/lib/storage";

type ThemePreference = "light" | "dark" | "system";

export function ThemeToggle(): React.ReactElement {
  const [theme, setTheme, isHydrated] = useLocalStorage<ThemePreference>(
    STORAGE_KEYS.theme,
    "system",
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && prefersDark);

    root.classList.toggle("dark", isDark);
  }, [theme, isHydrated]);

  const cycleTheme = () => {
    const order: ThemePreference[] = ["system", "light", "dark"];
    const currentIndex = order.indexOf(theme);
    const nextTheme = order[(currentIndex + 1) % order.length];
    setTheme(nextTheme);
  };

  const label =
    theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light";

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      aria-label={`Theme: ${label}. Click to change.`}
    >
      Theme: {label}
    </button>
  );
}
