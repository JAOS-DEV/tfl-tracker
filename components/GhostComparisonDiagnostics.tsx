import type {
  GhostComparisonSummary,
  GhostRunDiagnostics,
} from "@/lib/tfl/types";
import type { ReactNode } from "react";

interface GhostComparisonDiagnosticsProps {
  summary?: GhostComparisonSummary;
  runDiagnostics?: GhostRunDiagnostics[];
  legacyDiagnostics?: string[];
}

function listValue(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function Field({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}): React.ReactElement {
  return (
    <div>
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="font-medium text-zinc-800 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

export function GhostComparisonDiagnostics({
  summary,
  runDiagnostics,
  legacyDiagnostics,
}: GhostComparisonDiagnosticsProps): React.ReactElement | null {
  if (!summary && !runDiagnostics?.length && !legacyDiagnostics?.length) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
      {summary ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Ghost comparison summary
          </h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            <Field label="Route" value={summary.routeId} />
            <Field label="London time" value={summary.currentLondonTime} />
            <Field
              label="Schedule base version"
              value={summary.routeScheduleBaseVersion ?? "not loaded"}
            />
            <Field
              label="Live base version"
              value={summary.liveBaseVersion ?? "unknown"}
            />
            <Field
              label="Schedule loaded"
              value={summary.routeScheduleLoaded ? "yes" : "no"}
            />
            <Field
              label="Route sequence loaded"
              value={summary.routeSequenceLoaded ? "yes" : "no"}
            />
            <Field
              label="Live enrichment complete"
              value={summary.liveEnrichmentComplete ? "yes" : "no"}
            />
            <Field
              label="Live TfL vehicles / predictions"
              value={`${summary.liveTflVehicleCount} / ${summary.liveTflPredictionCount}`}
            />
            <Field
              label="Live registrations"
              value={listValue(summary.uniqueLiveVehicleRegistrations)}
            />
            <Field
              label="Live iBus running numbers"
              value={listValue(summary.uniqueLiveIbusRunningNumbers)}
            />
            <Field
              label="Active scheduled journeys"
              value={summary.activeScheduledJourneyCount}
            />
            <Field
              label="Active scheduled running numbers"
              value={listValue(summary.scheduledActiveRunningNumbers)}
            />
            <Field
              label="Live running numbers"
              value={listValue(summary.liveRunningNumbers)}
            />
            <Field
              label="Matched active scheduled runs"
              value={listValue(summary.matchedActiveScheduledRunningNumbers)}
            />
            <Field
              label="Scheduled missing live"
              value={listValue(summary.scheduledMissingLiveRunningNumbers)}
            />
            <Field
              label="Live runs not active in schedule"
              value={listValue(summary.liveRunningNumbersNotActiveInSchedule)}
            />
            <Field
              label="Live vehicles without resolved running number"
              value={summary.liveVehiclesWithoutResolvedRunningNumber}
            />
            <Field
              label="Visible schedule ghosts"
              value={listValue(summary.visibleScheduleGhostRunningNumbers)}
            />
            <Field
              label="Visible feed ghosts"
              value={listValue(summary.visibleFeedGhostRunningNumbers)}
            />
            <Field
              label="Visible disappeared ghosts"
              value={listValue(summary.visibleDisappearedGhostRunningNumbers)}
            />
            <Field
              label="Hidden schedule candidates"
              value={listValue(summary.hiddenScheduleCandidateRunningNumbers)}
            />
            <Field
              label="Hidden weak candidates"
              value={listValue(summary.hiddenWeakCandidateRunningNumbers)}
            />
            <Field
              label="Suppressed schedule candidates"
              value={listValue(summary.suppressedScheduleCandidateRunningNumbers)}
            />
            <Field
              label="Route sanity cap"
              value={summary.routeLevelSanityCapValue}
            />
            <Field
              label="Cap-hidden running numbers"
              value={listValue(summary.routeLevelSanityCapHiddenRunningNumbers)}
            />
          </dl>
          <p className="text-zinc-500 dark:text-zinc-400">
            {summary.feedGhostLifecycleNote}
          </p>
          {summary.sanityWarnings.length > 0 ? (
            <div className="rounded bg-amber-50 p-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {summary.sanityWarnings.map((warning) => (
                <p key={warning}>Route sanity warning: {warning}</p>
              ))}
            </div>
          ) : null}
          {Object.keys(summary.hiddenSuppressionReasonCounts).length > 0 ? (
            <pre className="overflow-x-auto rounded bg-zinc-100 p-2 text-[11px] dark:bg-zinc-900">
              {JSON.stringify(summary.hiddenSuppressionReasonCounts, null, 2)}
            </pre>
          ) : null}
        </section>
      ) : null}

      {runDiagnostics?.length ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Debug runs
          </h3>
          {runDiagnostics.map((run) => (
            <details
              key={`${run.routeId}-${run.runningNo}`}
              className="rounded-lg border border-zinc-200 bg-white/60 p-2 dark:border-zinc-700 dark:bg-zinc-950/50"
              open
            >
              <summary className="cursor-pointer font-semibold text-zinc-800 dark:text-zinc-100">
                Run {run.runningNo}: {run.finalDecision}
              </summary>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                <Field
                  label="Live matches"
                  value={run.liveMatches.length || "none"}
                />
                <Field
                  label="Schedule journeys"
                  value={`${run.scheduleJourneyCount} (${run.activeScheduleJourneyCount} active)`}
                />
                <Field
                  label="Candidate created"
                  value={run.candidateCreated ? "yes" : "no"}
                />
                <Field
                  label="Displayed"
                  value={
                    run.displayedAsLive
                      ? "live"
                      : run.displayedAsScheduleGhost
                        ? "schedule ghost"
                        : run.displayedAsDisappearedGhost
                          ? "disappeared ghost"
                          : run.displayedAsFeedGhost
                            ? "feed ghost"
                            : "no"
                  }
                />
                <Field
                  label="Suppression reasons"
                  value={listValue(run.suppressionReasons)}
                />
                <Field
                  label="Hidden reasons"
                  value={listValue(run.hiddenReasons)}
                />
              </dl>
              {run.scheduleJourneys.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[11px]">
                  {run.scheduleJourneys.map((journey) => (
                    <li key={`${run.runningNo}-${journey.tripId}`}>
                      {journey.tripId} · {journey.direction} ·{" "}
                      {journey.startTime}-{journey.endTime} ·{" "}
                      {journey.active
                        ? `${journey.positionSource ?? "position unknown"} / ${journey.confidence ?? "confidence unknown"}`
                        : journey.inactiveReason ?? "inactive"}
                    </li>
                  ))}
                </ul>
              ) : null}
            </details>
          ))}
        </section>
      ) : null}

      {legacyDiagnostics?.length ? (
        <details>
          <summary className="cursor-pointer font-semibold">
            Raw schedule diagnostics
          </summary>
          <div className="mt-2 space-y-1">
            {legacyDiagnostics.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
