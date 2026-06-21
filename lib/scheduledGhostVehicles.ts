import type { LoopLayoutConfig } from "@/lib/constants";
import {
  applyScheduleGhostDuplicateGuard,
  getScheduledGhostCandidates,
  scheduledGhostToVehiclePosition,
} from "@/lib/scheduledGhostBuses";
import type { ScheduledGhostPositionDiagnostics } from "@/lib/scheduledGhostBuses";
import { debugScheduledJourneyForRun } from "@/lib/scheduledGhostDebug";
import type { ScheduledRunDebugResult } from "@/lib/scheduledGhostDebug";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import { normalizeRunningNumber } from "@/lib/runningNumber";
import type {
  EstimatedVehiclePosition,
  GhostComparisonSummary,
  GhostRunDiagnostics,
  GhostRunLiveMatch,
  GhostRunScheduleJourneyDiagnostic,
  NormalizedRoute,
} from "@/lib/tfl/types";

export interface AppendScheduledGhostInput {
  routeId: string;
  route: NormalizedRoute;
  layout: LoopLayoutConfig;
  vehicles: EstimatedVehiclePosition[];
  schedule: IbusRouteSchedule | null | undefined;
  activeJourneys?: IbusRouteSchedule["journeys"];
  now: number;
  dataUpdatedAt: number;
  liveBaseVersion?: string;
  livePredictionCount?: number;
  showScheduleGhosts: boolean;
  includeLowConfidence: boolean;
  collectDiagnostics?: boolean;
  debugRunningNo?: string;
  debugRunningNos?: string[];
  liveEnrichmentComplete?: boolean;
}

export interface AppendScheduledGhostResult {
  vehicles: EstimatedVehiclePosition[];
  diagnostics: string[];
  ghostComparisonSummary?: GhostComparisonSummary;
  ghostRunDiagnostics?: GhostRunDiagnostics[];
}

const STALE_ROUTE_DATA_MS = 90_000;

function londonTimeLabel(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
}

function countDiagnosticsByReason(
  diagnostics: ScheduledGhostPositionDiagnostics[],
): Record<string, number> {
  return diagnostics.reduce<Record<string, number>>((counts, diagnostic) => {
    const key =
      diagnostic.suppressionReason ??
      diagnostic.reason ??
      diagnostic.positionSource;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function activeRunKey(diagnostic: ScheduledGhostPositionDiagnostics): string {
  return [
    diagnostic.routeId,
    normalizeRunningNumber(diagnostic.runningNo) ?? "",
    diagnostic.tripId,
    diagnostic.direction ?? "",
  ].join(":");
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function normalizedSet(values: string[]): Set<string> {
  return new Set(
    values
      .map((value) => normalizeRunningNumber(value))
      .filter((value): value is string => Boolean(value)),
  );
}

function differenceByRunningNumber(left: string[], right: string[]): string[] {
  const rightSet = normalizedSet(right);
  return left.filter((value) => {
    const normalized = normalizeRunningNumber(value);
    return normalized ? !rightSet.has(normalized) : false;
  });
}

function intersectionByRunningNumber(left: string[], right: string[]): string[] {
  const rightSet = normalizedSet(right);
  return left.filter((value) => {
    const normalized = normalizeRunningNumber(value);
    return normalized ? rightSet.has(normalized) : false;
  });
}

function diagnosticReason(diagnostic: ScheduledGhostPositionDiagnostics): string {
  return (
    diagnostic.suppressionReason ??
    diagnostic.reason ??
    diagnostic.positionSource
  );
}

function buildReasonCounts(
  reasons: string[],
  diagnostics: ScheduledGhostPositionDiagnostics[],
): Record<string, number> {
  return reasons
    .concat(diagnostics.map(diagnosticReason))
    .reduce<Record<string, number>>((counts, reason) => {
      counts[reason] = (counts[reason] ?? 0) + 1;
      return counts;
    }, {});
}

function runMatches(runningNo: string | undefined, target: string): boolean {
  return normalizeRunningNumber(runningNo) === normalizeRunningNumber(target);
}

function toLiveMatch(vehicle: EstimatedVehiclePosition): GhostRunLiveMatch {
  return {
    registration: vehicle.vehicleRegistration,
    vehicleId: vehicle.vehicleId,
    tripId: vehicle.tripId,
    baseVersion: vehicle.baseVersion,
    blockNo: vehicle.ibusBlockNo,
    direction: vehicle.direction,
    nextStop: vehicle.nextStop?.name ?? vehicle.nextPrediction.stopName,
    expectedArrival: vehicle.expectedArrival,
    displayedAsLive: true,
  };
}

function toScheduleJourneyDiagnostic(
  journey: ScheduledRunDebugResult["journeys"][number],
): GhostRunScheduleJourneyDiagnostic {
  return {
    tripId: journey.tripId,
    blockNo: journey.blockNo,
    direction: journey.routeDirection ?? journey.direction,
    startTime: journey.startTime,
    endTime: journey.endTime,
    active: journey.isServiceDayValid && journey.isActive,
    inactiveReason: journey.inactiveReason,
    previousStopName: journey.currentStopName,
    nextStopName: journey.currentStopName,
    positionSource: journey.positionSource,
    confidence: journey.confidence,
    candidateCreated: journey.candidateCreated,
  };
}

function buildFinalDecision(input: {
  runningNo: string;
  displayedAsLive: boolean;
  displayedAsScheduleGhost: boolean;
  displayedAsFeedGhost: boolean;
  displayedAsDisappearedGhost: boolean;
  presentInSchedule: boolean;
  activeScheduleJourneyCount: number;
  candidateCreated: boolean;
  suppressed: boolean;
  suppressionReasons: string[];
  hidden: boolean;
  hiddenReasons: string[];
}): string {
  if (input.displayedAsLive) {
    return `Run ${input.runningNo} is shown as a live bus.`;
  }
  if (input.displayedAsScheduleGhost) {
    return `Run ${input.runningNo} is shown as a schedule ghost because an active scheduled journey has no matching live bus.`;
  }
  if (input.displayedAsDisappearedGhost) {
    return `Run ${input.runningNo} appears as a feed/disappeared ghost, not a schedule ghost.`;
  }
  if (input.displayedAsFeedGhost) {
    return `Run ${input.runningNo} appears as a feed ghost from local prediction tracking, not a schedule ghost.`;
  }
  if (!input.presentInSchedule) {
    return `Run ${input.runningNo} is not present in the decoded route schedule.`;
  }
  if (input.activeScheduleJourneyCount === 0) {
    return `Run ${input.runningNo} is not shown because it is not active in our schedule at the current London time.`;
  }
  if (input.suppressed) {
    return `Run ${input.runningNo} is active but suppressed by ${input.suppressionReasons.join(", ")}.`;
  }
  if (input.hidden) {
    return `Run ${input.runningNo} is active but hidden by ${input.hiddenReasons.join(", ")}.`;
  }
  if (!input.candidateCreated) {
    return `Run ${input.runningNo} is active but no schedule ghost candidate was created.`;
  }
  return `Run ${input.runningNo} is not displayed; no more specific diagnostic reason was recorded.`;
}

function buildRunDiagnostics(input: {
  routeId: string;
  runningNo: string;
  scheduleDebug: ScheduledRunDebugResult;
  liveVehicles: EstimatedVehiclePosition[];
  visibleScheduleGhosts: EstimatedVehiclePosition[];
  feedGhosts: EstimatedVehiclePosition[];
  disappearedGhosts: EstimatedVehiclePosition[];
  allPositionDiagnostics: ScheduledGhostPositionDiagnostics[];
  duplicateGuardHiddenRunningNumbers: string[];
}): GhostRunDiagnostics {
  const liveMatches = input.liveVehicles
    .filter((vehicle) => runMatches(vehicle.ibusRunningNo, input.runningNo))
    .map(toLiveMatch);
  const displayedAsScheduleGhost = input.visibleScheduleGhosts.some((vehicle) =>
    runMatches(vehicle.scheduledGhostRunningNo, input.runningNo),
  );
  const displayedAsFeedGhost = input.feedGhosts.some((vehicle) =>
    runMatches(vehicle.ibusRunningNo, input.runningNo),
  );
  const displayedAsDisappearedGhost = input.disappearedGhosts.some((vehicle) =>
    runMatches(vehicle.ibusRunningNo, input.runningNo),
  );
  const relatedDiagnostics = input.allPositionDiagnostics.filter((diagnostic) =>
    runMatches(diagnostic.runningNo, input.runningNo),
  );
  const suppressionReasons = uniqueSorted(
    relatedDiagnostics
      .filter((diagnostic) =>
        diagnosticReason(diagnostic).includes("suppressed"),
      )
      .map(diagnosticReason)
      .concat(
        input.duplicateGuardHiddenRunningNumbers.some((run) =>
          runMatches(run, input.runningNo),
        )
          ? ["duplicate guard suppressed"]
          : [],
      ),
  );
  const hiddenReasons = uniqueSorted(
    relatedDiagnostics
      .filter((diagnostic) => !diagnostic.displayed)
      .map(diagnosticReason)
      .filter((reason) => !reason.includes("suppressed")),
  );
  const candidateCreated =
    input.scheduleDebug.displayedCandidateCount > 0 ||
    relatedDiagnostics.some((diagnostic) => diagnostic.displayed);
  const suppressed = suppressionReasons.length > 0;
  const hidden = hiddenReasons.length > 0;
  const displayedAsLive = liveMatches.length > 0;

  return {
    routeId: input.routeId,
    runningNo: input.runningNo,
    liveMatches,
    presentInSchedule: input.scheduleDebug.foundInSchedule,
    scheduleJourneyCount: input.scheduleDebug.journeyCount,
    activeScheduleJourneyCount: input.scheduleDebug.activeJourneyCount,
    scheduleJourneys: input.scheduleDebug.journeys.map(
      toScheduleJourneyDiagnostic,
    ),
    candidateCreated,
    suppressed,
    suppressionReasons,
    hidden,
    hiddenReasons,
    displayedAsLive,
    displayedAsScheduleGhost,
    displayedAsFeedGhost,
    displayedAsDisappearedGhost,
    finalDecision: buildFinalDecision({
      runningNo: input.runningNo,
      displayedAsLive,
      displayedAsScheduleGhost,
      displayedAsFeedGhost,
      displayedAsDisappearedGhost,
      presentInSchedule: input.scheduleDebug.foundInSchedule,
      activeScheduleJourneyCount: input.scheduleDebug.activeJourneyCount,
      candidateCreated,
      suppressed,
      suppressionReasons,
      hidden,
      hiddenReasons,
    }),
  };
}

export function appendScheduledGhostVehicles(
  input: AppendScheduledGhostInput,
): AppendScheduledGhostResult {
  const actualLiveVehicles = input.vehicles.filter(
    (vehicle) => !vehicle.ghostSource && !vehicle.isScheduledGhostCandidate,
  );
  const feedGhosts = input.vehicles.filter(
    (vehicle) => vehicle.ghostSource === "feed",
  );
  const disappearedGhosts = input.vehicles.filter(
    (vehicle) => vehicle.ghostSource === "disappeared",
  );

  if (!input.showScheduleGhosts || !input.schedule) {
    const nowDate = new Date(input.now);
    return {
      vehicles: input.vehicles,
      diagnostics: input.collectDiagnostics
        ? [
            `Schedule ghosts skipped: enabled=${input.showScheduleGhosts}, scheduleLoaded=${Boolean(input.schedule)}.`,
          ]
        : [],
      ghostComparisonSummary: input.collectDiagnostics
        ? {
            routeId: input.routeId,
            currentLondonTime: londonTimeLabel(nowDate),
            routeScheduleBaseVersion: input.schedule?.baseVersion ?? null,
            liveBaseVersion: input.liveBaseVersion ?? null,
            routeScheduleLoaded: Boolean(input.schedule),
            routeSequenceLoaded: input.route.outbound.length + input.route.inbound.length > 0,
            liveEnrichmentComplete: input.liveEnrichmentComplete ?? true,
            liveTflVehicleCount: actualLiveVehicles.length,
            liveTflPredictionCount: input.livePredictionCount ?? 0,
            uniqueLiveVehicleRegistrations: uniqueSorted(
              actualLiveVehicles.map((vehicle) => vehicle.vehicleRegistration),
            ),
            uniqueLiveIbusRunningNumbers: uniqueSorted(
              actualLiveVehicles.map((vehicle) => vehicle.ibusRunningNo),
            ),
            activeScheduledJourneyCount: 0,
            activeScheduledRunningNumbers: [],
            scheduledActiveRunningNumbers: [],
            liveRunningNumbers: uniqueSorted(
              actualLiveVehicles.map((vehicle) => vehicle.ibusRunningNo),
            ),
            matchedActiveScheduledRunningNumbers: [],
            scheduledMissingLiveRunningNumbers: [],
            liveRunningNumbersNotActiveInSchedule: uniqueSorted(
              actualLiveVehicles.map((vehicle) => vehicle.ibusRunningNo),
            ),
            liveVehiclesWithoutResolvedRunningNumber: actualLiveVehicles.filter(
              (vehicle) => !normalizeRunningNumber(vehicle.ibusRunningNo),
            ).length,
            visibleScheduleGhostRunningNumbers: [],
            visibleFeedGhostRunningNumbers: uniqueSorted(
              feedGhosts.map((vehicle) => vehicle.ibusRunningNo),
            ),
            visibleDisappearedGhostRunningNumbers: uniqueSorted(
              disappearedGhosts.map((vehicle) => vehicle.ibusRunningNo),
            ),
            hiddenScheduleCandidateRunningNumbers: [],
            hiddenWeakCandidateRunningNumbers: [],
            suppressedScheduleCandidateRunningNumbers: [],
            routeLevelSanityCapValue: 0,
            routeLevelSanityCapHiddenRunningNumbers: [],
            sanityWarnings: [],
            hiddenSuppressionReasonCounts: {},
            feedGhostLifecycleNote:
              "Feed/disappeared ghosts are local-only: the route must remain open, tracking is in memory, and a reload loses history.",
          }
        : undefined,
    };
  }

  const isRouteDataStale = input.now - input.dataUpdatedAt > STALE_ROUTE_DATA_MS;
  const liveVehicles = input.vehicles.filter(
    (vehicle) => !vehicle.isScheduledGhostCandidate,
  );
  const nowDate = new Date(input.now);
  const scheduledJourneys =
    input.activeJourneys ?? input.schedule.journeys;
  const activeScheduledJourneyCount = scheduledJourneys.length;

  const rawPositionDiagnostics: ScheduledGhostPositionDiagnostics[] | undefined =
    input.collectDiagnostics ? [] : undefined;
  const candidates = getScheduledGhostCandidates({
    routeId: input.routeId,
    now: new Date(input.now),
    liveVehicles,
    scheduledJourneys,
    route: input.route,
    layout: input.layout,
    liveBaseVersion: input.liveBaseVersion,
    scheduleBaseVersion: input.schedule.baseVersion,
    isRouteDataStale,
    includeLowConfidence: input.includeLowConfidence,
    diagnostics: rawPositionDiagnostics,
  });

  const guarded = applyScheduleGhostDuplicateGuard(
    input.routeId,
    liveVehicles,
    candidates,
    input.collectDiagnostics ?? false,
  );

  const legacyRouteCountCap = Math.max(
    0,
    activeScheduledJourneyCount - liveVehicles.length,
  );
  const visibleCandidates = guarded.candidates;
  const routeSanityHidden: typeof guarded.candidates = [];
  const scheduledGhosts = visibleCandidates.map(scheduledGhostToVehiclePosition);
  const routeSanityDiagnostics: ScheduledGhostPositionDiagnostics[] =
    routeSanityHidden
      .map((candidate) => candidate.positionDiagnostics)
      .filter(
        (diagnostic): diagnostic is ScheduledGhostPositionDiagnostics =>
          diagnostic !== undefined,
      )
      .map((diagnostic) => ({
        ...diagnostic,
        displayed: false,
        reason: "route-level sanity warning: weak candidate would be hidden",
      }));
  const allPositionDiagnostics = (rawPositionDiagnostics ?? [])
    .concat(
      visibleCandidates
        .map((candidate) => candidate.positionDiagnostics)
        .filter(
          (diagnostic): diagnostic is ScheduledGhostPositionDiagnostics =>
            diagnostic !== undefined,
        ),
    )
    .concat(routeSanityDiagnostics);
  const duplicateGuardHidden = candidates.filter(
    (candidate) => !guarded.candidates.includes(candidate),
  );
  const duplicateGuardHiddenReasons = duplicateGuardHidden.map(
    () => "duplicate guard suppressed",
  );
  const activeScheduledJourneys = scheduledJourneys;
  const scheduledActiveRunningNumbers = uniqueSorted(
    activeScheduledJourneys.map((journey) => journey.runningNo),
  );
  const liveRunningNumbers = uniqueSorted(
    actualLiveVehicles.map((vehicle) => vehicle.ibusRunningNo),
  );
  const matchedScheduledRunningNumbers = uniqueSorted(
    allPositionDiagnostics
      .filter(
        (diagnostic) =>
          diagnostic.reason === "suppressed by plausible live match",
      )
      .map((diagnostic) => diagnostic.runningNo)
      .concat(
        intersectionByRunningNumber(
          scheduledActiveRunningNumbers,
          liveRunningNumbers,
        ),
      ),
  );
  const scheduledMissingLiveRunningNumbers = differenceByRunningNumber(
    scheduledActiveRunningNumbers,
    matchedScheduledRunningNumbers,
  );
  const liveRunningNumbersNotActiveInSchedule = differenceByRunningNumber(
    liveRunningNumbers,
    scheduledActiveRunningNumbers,
  );
  const liveVehiclesWithoutResolvedRunningNumber = actualLiveVehicles.filter(
    (vehicle) => !normalizeRunningNumber(vehicle.ibusRunningNo),
  ).length;
  const hiddenWeakCandidateRunningNumbers = uniqueSorted(
    allPositionDiagnostics
      .filter((diagnostic) => {
        if (diagnostic.displayed) {
          return false;
        }
        const reason = diagnosticReason(diagnostic);
        return (
          reason.includes("low confidence") ||
          reason.includes("grace-only") ||
          reason.includes("one-sided") ||
          reason.includes("unavailable") ||
          reason.includes("stale") ||
          reason.includes("baseVersion")
        );
      })
      .map((diagnostic) => diagnostic.runningNo),
  );
  const sanityWarnings =
    legacyRouteCountCap < guarded.candidates.length
      ? [
          "Total live count is close to schedule count, but high-confidence missing runs are displayed by running number.",
        ]
      : [];
  const ghostComparisonSummary: GhostComparisonSummary | undefined =
    input.collectDiagnostics
      ? {
          routeId: input.routeId,
          currentLondonTime: londonTimeLabel(nowDate),
          routeScheduleBaseVersion: input.schedule.baseVersion,
          liveBaseVersion: input.liveBaseVersion ?? null,
          routeScheduleLoaded: true,
          routeSequenceLoaded:
            input.route.outbound.length + input.route.inbound.length > 0,
          liveEnrichmentComplete: input.liveEnrichmentComplete ?? true,
          liveTflVehicleCount: actualLiveVehicles.length,
          liveTflPredictionCount: input.livePredictionCount ?? 0,
          uniqueLiveVehicleRegistrations: uniqueSorted(
            actualLiveVehicles.map((vehicle) => vehicle.vehicleRegistration),
          ),
          uniqueLiveIbusRunningNumbers: uniqueSorted(
            actualLiveVehicles.map((vehicle) => vehicle.ibusRunningNo),
          ),
          activeScheduledJourneyCount,
          activeScheduledRunningNumbers: uniqueSorted(
            activeScheduledJourneys.map((journey) => journey.runningNo),
          ),
          scheduledActiveRunningNumbers,
          liveRunningNumbers,
          matchedActiveScheduledRunningNumbers: matchedScheduledRunningNumbers,
          scheduledMissingLiveRunningNumbers,
          liveRunningNumbersNotActiveInSchedule,
          liveVehiclesWithoutResolvedRunningNumber,
          visibleScheduleGhostRunningNumbers: uniqueSorted(
            scheduledGhosts.map((vehicle) => vehicle.scheduledGhostRunningNo),
          ),
          visibleFeedGhostRunningNumbers: uniqueSorted(
            feedGhosts.map((vehicle) => vehicle.ibusRunningNo),
          ),
          visibleDisappearedGhostRunningNumbers: uniqueSorted(
            disappearedGhosts.map((vehicle) => vehicle.ibusRunningNo),
          ),
          hiddenScheduleCandidateRunningNumbers: uniqueSorted(
            allPositionDiagnostics
              .filter((diagnostic) => !diagnostic.displayed)
              .map((diagnostic) => diagnostic.runningNo),
          ),
          hiddenWeakCandidateRunningNumbers,
          suppressedScheduleCandidateRunningNumbers: uniqueSorted(
            allPositionDiagnostics
              .filter((diagnostic) =>
                diagnosticReason(diagnostic).includes("suppressed"),
              )
              .map((diagnostic) => diagnostic.runningNo)
              .concat(duplicateGuardHidden.map((candidate) => candidate.runningNo)),
          ),
          routeLevelSanityCapValue: legacyRouteCountCap,
          routeLevelSanityCapHiddenRunningNumbers: uniqueSorted(
            routeSanityHidden.map((candidate) => candidate.runningNo),
          ),
          sanityWarnings,
          hiddenSuppressionReasonCounts: buildReasonCounts(
            duplicateGuardHiddenReasons,
            allPositionDiagnostics.filter((diagnostic) => !diagnostic.displayed),
          ),
          feedGhostLifecycleNote:
            "Feed/disappeared ghosts are local-only: the route must remain open, tracking is in memory, and a reload loses history.",
        }
      : undefined;
  const debugRunNos = uniqueSorted(
    [input.debugRunningNo].concat(input.debugRunningNos ?? []),
  );
  const scheduleDebugs = debugRunNos.map((runningNo) =>
    debugScheduledJourneyForRun({
      routeSchedule: input.schedule,
      routeId: input.routeId,
      runningNo,
      now: new Date(input.now),
      liveVehicles,
      route: input.route,
      liveBaseVersion: input.liveBaseVersion,
      dataUpdatedAt: input.dataUpdatedAt,
      includeLowConfidence: input.includeLowConfidence,
    }),
  );
  const ghostRunDiagnostics =
    input.collectDiagnostics && scheduleDebugs.length > 0
      ? scheduleDebugs.map((scheduleDebug) =>
          buildRunDiagnostics({
            routeId: input.routeId,
            runningNo: scheduleDebug.runningNo,
            scheduleDebug,
            liveVehicles: actualLiveVehicles,
            visibleScheduleGhosts: scheduledGhosts,
            feedGhosts,
            disappearedGhosts,
            allPositionDiagnostics,
            duplicateGuardHiddenRunningNumbers: duplicateGuardHidden.map(
              (candidate) => candidate.runningNo,
            ),
          }),
        )
      : undefined;
  const positionDiagnostics = input.collectDiagnostics
    ? allPositionDiagnostics.map(
        (diagnostic) =>
          `Schedule ghost position: ${JSON.stringify(diagnostic)}`,
      )
    : [];
  const debugRunDiagnostics =
    input.collectDiagnostics && scheduleDebugs.length > 0
      ? scheduleDebugs.map(
          (scheduleDebug) =>
            `Schedule run debug: ${JSON.stringify(scheduleDebug)}`,
        )
      : [];

  const diagnostics = input.collectDiagnostics
    ? (() => {
        const activeRunDiagnostics = Array.from(
          new Map(
            allPositionDiagnostics.map((diagnostic) => [
              activeRunKey(diagnostic),
              diagnostic,
            ]),
          ).values(),
        ).map(
          (diagnostic) =>
            `Schedule active run: ${JSON.stringify({
              routeId: diagnostic.routeId,
              runningNo: diagnostic.runningNo,
              tripId: diagnostic.tripId,
              direction: diagnostic.direction,
              positionSource: diagnostic.positionSource,
              matchedToLive:
                diagnostic.reason === "suppressed by plausible live match",
              displayedAsGhost: diagnostic.displayed,
              reason: diagnostic.reason,
              suppressionReason: diagnostic.suppressionReason,
            })}`,
        );
        const summary = {
          routeId: input.routeId,
          currentLondonTime: londonTimeLabel(nowDate),
          scheduleBaseVersion: input.schedule.baseVersion,
          liveBaseVersion: input.liveBaseVersion ?? null,
          totalScheduledJourneys: input.schedule.journeys.length,
          activeScheduledJourneys: activeScheduledJourneyCount,
          liveVehicleCount: liveVehicles.length,
          livePredictionCount: input.livePredictionCount ?? null,
          liveVehiclesWithIbusRunningNo: liveVehicles.filter(
            (vehicle) => vehicle.ibusRunningNo,
          ).length,
          matchedScheduledToLive: allPositionDiagnostics.filter(
            (diagnostic) =>
              diagnostic.reason === "suppressed by plausible live match",
          ).length,
          unmatchedActiveScheduled: allPositionDiagnostics.filter(
            (diagnostic) =>
              diagnostic.reason !== "suppressed by plausible live match",
          ).length,
          visibleScheduleGhosts: scheduledGhosts.length,
          hiddenLowConfidence: allPositionDiagnostics.filter(
            (diagnostic) => diagnostic.reason === "low confidence hidden",
          ).length,
          blockedUnpositionable: allPositionDiagnostics.filter(
            (diagnostic) => diagnostic.positionSource === "unavailable",
          ).length,
          expectedScheduledActive: activeScheduledJourneyCount,
          actualLiveBuses: liveVehicles.length,
          explainedTotal: liveVehicles.length + scheduledGhosts.length,
          hiddenOrBlockedCandidates: allPositionDiagnostics.filter(
            (diagnostic) => !diagnostic.displayed,
          ).length,
          suppressedByReason: countDiagnosticsByReason(allPositionDiagnostics),
          routeLevelSanityCap: legacyRouteCountCap,
          routeLevelSanityWarnings: sanityWarnings,
          liveEnrichmentComplete: input.liveEnrichmentComplete ?? true,
        };
        return [
          `Schedule ghosts route ${input.routeId}: journeys=${input.schedule.journeys.length}, active=${activeScheduledJourneyCount}, live=${liveVehicles.length}, predictions=${input.livePredictionCount ?? "unknown"}, candidates=${candidates.length}, appended=${scheduledGhosts.length}, stale=${isRouteDataStale}, baseVersion=${input.schedule.baseVersion}, liveEnrichmentComplete=${input.liveEnrichmentComplete ?? true}.`,
          `Schedule sanity summary: ${JSON.stringify(summary)}`,
          ...guarded.diagnostics,
          ...positionDiagnostics,
          ...activeRunDiagnostics,
          ...debugRunDiagnostics,
        ];
      })()
    : guarded.diagnostics;

  if (process.env.NODE_ENV === "development" && input.collectDiagnostics) {
    console.debug(diagnostics.join(" "));
  }

  return {
    vehicles: [...liveVehicles, ...scheduledGhosts],
    diagnostics,
    ghostComparisonSummary,
    ghostRunDiagnostics,
  };
}
