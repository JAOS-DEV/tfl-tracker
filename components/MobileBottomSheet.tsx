"use client";

import type { ReactNode } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface MobileBottomSheetProps {
  title: ReactNode;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeAriaLabel?: string;
}

export function MobileBottomSheet({
  title,
  titleId,
  onClose,
  children,
  footer,
  closeAriaLabel = "Close dialog",
}: MobileBottomSheetProps): React.ReactElement {
  useBodyScrollLock(true);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <button
        type="button"
        aria-label="Dismiss dialog"
        className="absolute inset-0 cursor-default bg-black/50"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-xl max-h-[min(92dvh,720px)] pb-[env(safe-area-inset-bottom)] sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-0 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div
          className="flex shrink-0 items-center justify-center pt-3 sm:hidden"
          aria-hidden="true"
        >
          <span className="h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>

        <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div id={titleId} className="min-w-0 flex-1">
            {typeof title === "string" ? (
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h2>
            ) : (
              title
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeAriaLabel}
            className="min-h-11 min-w-11 rounded-xl px-3 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </header>

        <div
          data-sheet-scroll-container="true"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
            {footer}
          </div>
        ) : null}
      </section>
    </div>
  );
}
