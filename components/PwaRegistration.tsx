"use client";

import { useEffect } from "react";

export function PwaRegistration(): null {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration is best-effort for offline shell only.
    });
  }, []);

  return null;
}
