"use client";

import { useEffect, useState } from "react";
import { canShowInstallInstructions } from "@/lib/platform";
import { STORAGE_KEYS } from "@/lib/storage";

export function InstallAppBanner(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      if (!canShowInstallInstructions()) {
        return;
      }

      try {
        const dismissed = window.localStorage.getItem(
          STORAGE_KEYS.installBannerDismissed,
        );
        setVisible(dismissed !== "true");
      } catch {
        setVisible(true);
      }
    });
  }, []);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.installBannerDismissed, "true");
    } catch {
      // Ignore storage failures.
    }
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <section
      aria-label="Install app instructions"
      className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/40"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Install on your iPhone
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            This app can be added to your Home Screen. In Safari, tap the Share
            button, then choose <span className="font-medium">Add to Home Screen</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install instructions"
          className="min-h-11 min-w-11 shrink-0 rounded-lg text-lg text-zinc-500 hover:bg-sky-100 dark:text-zinc-400 dark:hover:bg-sky-900/50"
        >
          ×
        </button>
      </div>
    </section>
  );
}
