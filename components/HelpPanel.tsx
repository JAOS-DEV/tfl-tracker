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
          <li>
            The loop view is a schematic diagram — it does not match real road
            geography.
          </li>
          <li>
            Bus positions on the loop are estimated from TfL arrival predictions,
            not exact GPS.
          </li>
          <li>
            Bus ring colours (green, yellow, red) are estimated from live
            predictions compared with other vehicles on the route — not official
            timetable early/late status.
          </li>
          <li>Predictions refresh roughly every 30 seconds.</li>
          <li>
            Gap and bunching badges are based on predicted arrivals, not
            official schedule early/late status.
          </li>
          <li>
            Share routes with a URL like{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              ?routes=337,220
            </code>
            .
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
