"use client";

import { useState } from "react";

export function HelpPanel(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Help & About
        </h2>
        <span className="text-sm text-zinc-500">{isOpen ? "Hide" : "Show"}</span>
      </button>

      {isOpen ? (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
          <li>Live bus data comes from TfL Open Data via the Unified API.</li>
          <li>Predictions refresh roughly every 30 seconds.</li>
          <li>
            Vehicle positioning is inferred from prediction data and may not
            reflect exact GPS locations.
          </li>
          <li>
            Early/late schedule status is not part of this MVP and may be added
            later.
          </li>
          <li>
            This is an independent project and is not affiliated with or
            endorsed by Transport for London.
          </li>
        </ul>
      ) : null}
    </section>
  );
}
