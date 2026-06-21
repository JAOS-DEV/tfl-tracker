"use client";

import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";

const DiagnosticsExpandContext = createContext<boolean | undefined>(undefined);

interface DiagnosticsSectionProps {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function DiagnosticsSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: DiagnosticsSectionProps): React.ReactElement {
  const contentId = useId();
  const forcedOpen = useContext(DiagnosticsExpandContext);
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = forcedOpen ?? open;

  return (
    <section className="rounded-md border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/40">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {title}
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
            {summary}
          </span>
        </span>
        <span className="shrink-0 pt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>
      {isOpen ? (
        <div
          id={contentId}
          className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

interface DiagnosticsPanelGroupProps {
  children: ReactNode;
}

export function DiagnosticsPanelGroup({
  children,
}: DiagnosticsPanelGroupProps): React.ReactElement {
  const [forcedOpen, setForcedOpen] = useState<boolean | undefined>(undefined);
  const [groupKey, setGroupKey] = useState(0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          onClick={() => {
            setForcedOpen(true);
            setGroupKey((key) => key + 1);
          }}
        >
          Expand all
        </button>
        <button
          type="button"
          className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          onClick={() => {
            setForcedOpen(false);
            setGroupKey((key) => key + 1);
          }}
        >
          Collapse all
        </button>
      </div>
      <DiagnosticsExpandContext.Provider value={forcedOpen}>
        <div key={groupKey} className="space-y-2">
          {children}
        </div>
      </DiagnosticsExpandContext.Provider>
    </div>
  );
}
