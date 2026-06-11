"use client";

import { useState } from "react";
import { AboutDataContent } from "@/components/AboutDataContent";

export function HelpPanel(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          About & Data
        </h2>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>

      {isOpen ? (
        <div className="mt-4">
          <AboutDataContent />
        </div>
      ) : null}
    </section>
  );
}
