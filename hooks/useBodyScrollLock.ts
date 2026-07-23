"use client";

import { useEffect } from "react";

/**
 * Locks document scroll while a modal/sheet is open.
 * Uses position:fixed on iOS to avoid rubber-band scroll behind the overlay.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === "undefined") {
      return;
    }

    const { body } = document;
    const scrollY = window.scrollY;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const previousTouchAction = body.style.touchAction;
    const previousPaddingRight = body.style.paddingRight;

    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.touchAction = previousTouchAction;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      body.style.paddingRight = previousPaddingRight;
      try {
        window.scrollTo(0, scrollY);
      } catch {
        // jsdom may not implement scrollTo
      }
    };
  }, [locked]);
}
