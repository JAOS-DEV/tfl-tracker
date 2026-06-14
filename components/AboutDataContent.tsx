export function AboutDataContent(): React.ReactElement {
  return (
    <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-300">
      <p>
        This app uses <strong>TfL Open Data</strong> via the Unified API. It is
        an <strong>independent project</strong> and is not affiliated with or
        endorsed by Transport for London.
      </p>

      <ul className="list-disc space-y-2 pl-5">
        <li>
          Bus positions on the loop are estimated from TfL arrival predictions,
          not exact GPS.
        </li>
        <li>
          Early/late status is estimated by comparing live predictions with
          timetable data. Timetable matching can be uncertain, especially on
          branches or when timetables are partial or unavailable.
        </li>
        <li>
          Ghost bus detection is inferred from repeated prediction
          disappearance. Ghost status means <strong>possible</strong>, not
          confirmed.
        </li>
        <li>
          Local history only records while the app is open on this device.
        </li>
        <li>
          Service health is a local heuristic based on live predictions — not an
          official TfL score.
        </li>
        <li>
          The loop view is schematic and does not match real road geography.
        </li>
        <li>
          Predictions refresh roughly every 30 seconds while the app is open.
        </li>
        <li>
          Share routes with a URL like{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
            ?routes=337,220
          </code>
          .
        </li>
        <li>
          Favourites, recent routes, alert preferences, and history stay on this
          device.
        </li>
        <li>
          Fleet numbers are primarily matched from TfL iBus static Vehicle data
          using the vehicle registration. If no TfL iBus match is found,
          Bustimes may be used as an optional fallback where available.
        </li>
        <li>
          Data may be stale, missing, or incomplete. Do not use this app for
          safety-critical travel decisions.
        </li>
      </ul>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Powered by TfL Open Data. This is an independent project and is not
        affiliated with or endorsed by Transport for London.
      </p>
    </div>
  );
}
