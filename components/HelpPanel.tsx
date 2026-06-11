"use client";

import { useState } from "react";

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
        <span className="text-sm text-zinc-500">{isOpen ? "Hide" : "Show"}</span>
      </button>

      {isOpen ? (
        <div className="mt-4 space-y-4 text-sm text-zinc-600 dark:text-zinc-300">
          <p>
            This app uses{" "}
            <strong>TfL Open Data</strong> via the Unified API. It is an{" "}
            <strong>independent project</strong> and is not affiliated with or
            endorsed by Transport for London.
          </p>

          <ul className="list-disc space-y-2 pl-5">
            <li>
              The loop view is a schematic diagram — it does not match real road
              geography.
            </li>
            <li>
              Bus positions on the loop are estimated from TfL arrival
              predictions, not exact GPS.
            </li>
            <li>
              Early/late status is estimated by comparing TfL live prediction
              data with timetable data. This app does not have access to official
              bus controller running boards or internal TfL operational decisions.
            </li>
            <li>
              Ghost bus detection is inferred from repeated prediction
              disappearance. TfL data can flicker, so ghost status is only
              “possible”, not confirmed.
            </li>
            <li>
              Bus ring colours and service health scores are local heuristics
              based on live predictions — not official TfL timetable or
              performance scores.
            </li>
            <li>Predictions refresh roughly every 30 seconds while the app is open.</li>
            <li>
              Gap, bunching, and in-app alert badges are based on predicted
              arrivals, not official schedule early/late status.
            </li>
            <li>
              Route history is stored locally on this device and only covers
              periods when the app was open.
            </li>
            <li>
              Data may be stale, missing, or incomplete. Do not use this app for
              safety-critical travel decisions.
            </li>
            <li>
              Share routes with a URL like{" "}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                ?routes=337,220
              </code>
              .
            </li>
            <li>
              Favourites, recent routes, alert preferences, and history stay on
              this device. Your TfL API key is never stored in the browser.
            </li>
          </ul>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Powered by TfL Open Data. This is an independent project and is not
            affiliated with or endorsed by Transport for London.
          </p>
        </div>
      ) : null}
    </section>
  );
}
