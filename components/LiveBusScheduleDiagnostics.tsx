import type {
  LiveBusScheduleDiagnostic,
  ScheduleTimingDiagnostics,
} from "@/lib/schedulePipeline/types";

interface LiveBusScheduleDiagnosticsProps {
  summary?: ScheduleTimingDiagnostics;
  diagnostics?: LiveBusScheduleDiagnostic[];
  part?: "all" | "summary" | "details";
  embedded?: boolean;
}

function listCounts(
  counts: Record<string, number | undefined> | undefined,
): string {
  if (!counts) {
    return "none";
  }
  const entries = Object.entries(counts).filter(([, count]) => (count ?? 0) > 0);
  if (entries.length === 0) {
    return "none";
  }
  return entries
    .map(([reason, count]) => `${reason}: ${count}`)
    .join(", ");
}

function explainServiceTime(rawTime: string, rolloverDays: number): string {
  const [rawHour = "0", minute = "00"] = rawTime.split(":");
  const clockHour = Number(rawHour) % 24;
  const dayLabel =
    rolloverDays === 1
      ? "the next London calendar day"
      : `${rolloverDays} London calendar days later`;
  return `${rawTime} means ${String(clockHour).padStart(2, "0")}:${minute} on ${dayLabel}.`;
}

function formatDiagnosticTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  const london = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  const utc = date.toISOString().slice(11, 19);
  return `${london} London (${utc} UTC)`;
}

export function LiveBusScheduleDiagnostics({
  summary,
  diagnostics,
  part = "all",
  embedded = false,
}: LiveBusScheduleDiagnosticsProps): React.ReactElement | null {
  const showSummary = part === "all" || part === "summary";
  const showDetails = part === "all" || part === "details";

  if (
    (showSummary && !summary) &&
    (showDetails && !diagnostics?.length)
  ) {
    return null;
  }

  if (!showSummary && showDetails && !diagnostics?.length) {
    return null;
  }

  if (showSummary && !showDetails && !summary) {
    return null;
  }

  const containerClass = embedded
    ? "space-y-2"
    : "space-y-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300";

  return (
    <section className={containerClass}>
      {!embedded && part === "all" ? (
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          Live bus schedule diagnostics
        </h3>
      ) : null}
      {showSummary && summary ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Active schedule pool</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.liveMatchingPoolCount}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Candidate matches</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.candidateMatchCount}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Trusted timing</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.trustedTimingCount}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Rejected timing</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.rejectedTimingCount}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Blue / unknown live buses</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.blueUnknownLiveCount ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">iBus data source</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.ibusDataSource ?? "unknown"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 dark:text-zinc-400">iBus data base URL</dt>
            <dd className="break-all font-medium text-zinc-800 dark:text-zinc-100">
              {summary.ibusDataBaseUrl ?? "unknown"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Manifest loaded from</dt>
            <dd className="break-all font-medium text-zinc-800 dark:text-zinc-100">
              {summary.manifestLoadedFrom ?? "none"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Route schedule loaded from</dt>
            <dd className="break-all font-medium text-zinc-800 dark:text-zinc-100">
              {summary.routeScheduleLoadedFrom ?? "none"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Running shard loaded from</dt>
            <dd className="break-all font-medium text-zinc-800 dark:text-zinc-100">
              {summary.runningShardLoadedFrom ?? "none"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Live baseVersion</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.liveBaseVersion ?? "none"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Static baseVersion</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.staticBaseVersion ?? "none"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Route schedule baseVersion</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.routeScheduleBaseVersion ?? "none"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Selected baseVersion</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.selectedBaseVersion ?? "none"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Selected because</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.selectedBecause ?? "unknown"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Active baseVersion (XML)</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.activeBaseVersionFromXml ?? "none"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Available local versions for route</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.availableLocalVersionsForRoute?.join(", ") ?? "none"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Lookup attempted keys</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.lookupAttemptedKeys?.join(", ") ?? "none"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">BaseVersion matches</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {summary.baseVersionMatches === undefined
                ? "unknown"
                : summary.baseVersionMatches
                  ? "yes"
                  : "no"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Internal rejection reasons</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {listCounts(summary.rejectionReasonCounts)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Blue bus unknown reasons</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-100">
              {listCounts(summary.unknownReasonCounts)}
            </dd>
          </div>
          {summary.sampleLivePrediction ? (
            <div className="sm:col-span-2 rounded border border-zinc-200 px-2 py-2 dark:border-zinc-700">
              <p className="font-medium text-zinc-800 dark:text-zinc-100">
                Sample live prediction
              </p>
              <p>raw tripId: {summary.sampleLivePrediction.rawTripId ?? "none"}</p>
              <p>
                raw baseVersion:{" "}
                {summary.sampleLivePrediction.rawBaseVersion ?? "none"}
              </p>
              <p>
                normalized tripId:{" "}
                {summary.sampleLivePrediction.normalizedTripId ?? "none"}
              </p>
              <p>
                normalized baseVersion:{" "}
                {summary.sampleLivePrediction.normalizedBaseVersion ?? "none"}
              </p>
              <p>
                fields used: {summary.sampleLivePrediction.fieldsUsedForBaseVersion}
              </p>
            </div>
          ) : null}
        </dl>
      ) : null}
      {showDetails && diagnostics?.length ? (
        <div className="space-y-2">
          {diagnostics.map((entry) => (
            <article
              key={entry.vehicleId}
              className="rounded border border-zinc-200 px-2 py-2 dark:border-zinc-700"
            >
              <p className="font-medium text-zinc-800 dark:text-zinc-100">
                {entry.vehicleRegistration ?? entry.vehicleId}
                {entry.ibusRunningNo ? ` · run ${entry.ibusRunningNo}` : ""}
                {entry.ibusBlockNo ? ` · block ${entry.ibusBlockNo}` : ""}
              </p>
              <dl className="mt-1 grid gap-1 sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Unknown reason</dt>
                  <dd>{entry.unknownReason}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Position known</dt>
                  <dd>{entry.positionKnown ? "yes" : "no"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Candidate match</dt>
                  <dd>
                    {entry.candidateMatch
                      ? `yes (${entry.candidateMatchMethod ?? "unknown method"})`
                      : "no"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Trusted timing</dt>
                  <dd>{entry.trustedTiming ? "yes" : "no"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Raw deviation</dt>
                  <dd>
                    {entry.rawDeviationMinutes === null
                      ? "n/a"
                      : `${entry.rawDeviationMinutes} min`}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Final state</dt>
                  <dd>
                    {entry.finalScheduleStatus} / {entry.finalAdherence}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Next stop</dt>
                  <dd>
                    {entry.nextStopName ?? "none"}
                    {entry.nextStopNaptan ? ` (${entry.nextStopNaptan})` : ""}
                  </dd>
                </div>
                {entry.tripId ? (
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-500 dark:text-zinc-400">Trip / base version</dt>
                    <dd>
                      {entry.tripId}
                      {entry.baseVersion ? ` / ${entry.baseVersion}` : ""}
                    </dd>
                  </div>
                ) : null}
                {entry.scheduleExplanation ? (
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-500 dark:text-zinc-400">Explanation</dt>
                    <dd>{entry.scheduleExplanation}</dd>
                  </div>
                ) : null}
                {entry.liveTimingAudit ? (
                  <div className="sm:col-span-2 rounded border border-sky-200 bg-sky-50 p-2 dark:border-sky-900 dark:bg-sky-950/30">
                    <p className="font-medium text-zinc-800 dark:text-zinc-100">
                      Live API clock check
                    </p>
                    <p className="mb-1">
                      This checks TfL&apos;s own calculation before comparing it with the static schedule.
                    </p>
                    <dl className="grid gap-1 sm:grid-cols-2">
                      <div>
                        <dt>TfL prediction timestamp</dt>
                        <dd>
                          {formatDiagnosticTimestamp(
                            entry.liveTimingAudit.apiTimestampUtc,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>TfL time to station</dt>
                        <dd>{entry.liveTimingAudit.timeToStationSeconds} sec</dd>
                      </div>
                      <div>
                        <dt>TfL expected arrival</dt>
                        <dd>
                          {formatDiagnosticTimestamp(
                            entry.liveTimingAudit.expectedArrivalUtc,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Timestamp + time to station</dt>
                        <dd>
                          {formatDiagnosticTimestamp(
                            entry.liveTimingAudit.timestampPlusTimeToStationUtc,
                          )}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt>Live API internal difference</dt>
                        <dd>{entry.liveTimingAudit.consistencyDifferenceSeconds} sec</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
                {entry.timingTrace ? (
                  <div className="sm:col-span-2 rounded border border-zinc-200 p-2 dark:border-zinc-700">
                    <p className="font-medium text-zinc-800 dark:text-zinc-100">
                      Candidate timing trace
                    </p>
                    <dl className="mt-1 grid gap-1 sm:grid-cols-2">
                      <div>
                        <dt>Journey</dt>
                        <dd>{entry.timingTrace.journeyId}</dd>
                      </div>
                      <div>
                        <dt>Raw service-day journey</dt>
                        <dd>
                          {entry.timingTrace.rawJourneyStartServiceTime}–
                          {entry.timingTrace.rawJourneyEndServiceTime}
                        </dd>
                      </div>
                      <div>
                        <dt>Raw scheduled stop</dt>
                        <dd>{entry.timingTrace.rawScheduledServiceTime}</dd>
                      </div>
                      <div>
                        <dt>Static service day (London)</dt>
                        <dd>{entry.timingTrace.staticServiceDayLondon}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt>Static after-midnight meaning</dt>
                        <dd>
                          {explainServiceTime(
                            entry.timingTrace.rawScheduledServiceTime,
                            entry.timingTrace.staticRolloverDays,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Difference</dt>
                        <dd>{entry.timingTrace.stopTimeDifferenceMinutes} min</dd>
                      </div>
                      <div>
                        <dt>Live expected UTC</dt>
                        <dd>{entry.timingTrace.liveExpectedArrivalUtc}</dd>
                      </div>
                      <div>
                        <dt>Live expected London</dt>
                        <dd>{entry.timingTrace.liveExpectedArrivalLondon}</dd>
                      </div>
                      <div>
                        <dt>Scheduled UTC</dt>
                        <dd>{entry.timingTrace.scheduledArrivalUtc}</dd>
                      </div>
                      <div>
                        <dt>Scheduled London</dt>
                        <dd>{entry.timingTrace.scheduledArrivalLondon}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt>Candidate rejection</dt>
                        <dd>{entry.timingTrace.rejectionReason ?? "accepted"}</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
