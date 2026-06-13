import type { ServiceHealthMetrics } from "@/lib/tfl/types";

export interface ServiceHealthSummaryChip {
  id: string;
  label: string;
  variant:
    | "good"
    | "warning"
    | "danger"
    | "info"
    | "ghost"
    | "late"
    | "early"
    | "onTime"
    | "unknown"
    | "muted"
    | "live";
}

export interface ServiceHealthSummary {
  healthLabel: string;
  healthScore: number;
  topWarning: string | null;
  chips: ServiceHealthSummaryChip[];
}

function healthVariant(score: number): ServiceHealthSummaryChip["variant"] {
  if (score >= 85) {
    return "good";
  }
  if (score >= 65) {
    return "info";
  }
  if (score >= 40) {
    return "warning";
  }
  return "danger";
}

interface BuildServiceHealthSummaryOptions {
  isFetching?: boolean;
  isStale?: boolean;
  largeGapThresholdMinutes?: number | null;
}

export function buildServiceHealthSummary(
  metrics: ServiceHealthMetrics,
  options?: BuildServiceHealthSummaryOptions,
): ServiceHealthSummary {
  const chips: ServiceHealthSummaryChip[] = [];
  const largeGapThresholdMinutes =
    options?.largeGapThresholdMinutes === undefined
      ? 12
      : options.largeGapThresholdMinutes;
  const showLargeGap =
    largeGapThresholdMinutes !== null &&
    metrics.largestGapMinutes !== null &&
    metrics.largestGapMinutes >= largeGapThresholdMinutes;

  if (options?.isFetching) {
    chips.push({ id: "refreshing", label: "Refreshing…", variant: "info" });
  } else if (options?.isStale || metrics.isDataStale) {
    chips.push({ id: "stale", label: "Stale data", variant: "warning" });
  } else {
    chips.push({ id: "live", label: "Live now", variant: "live" });
  }

  chips.push({
    id: "health",
    label: `${metrics.healthScore} · ${metrics.healthLabel}`,
    variant: healthVariant(metrics.healthScore),
  });

  chips.push({
    id: "live-count",
    label:
      metrics.liveVehicleCount === 1
        ? "1 bus"
        : `${metrics.liveVehicleCount} buses`,
    variant: metrics.liveVehicleCount > 0 ? "good" : "muted",
  });

  if (metrics.estimatedLateCount > 0) {
    chips.push({
      id: "late",
      label:
        metrics.estimatedLateCount === 1
          ? "1 late"
          : `${metrics.estimatedLateCount} late`,
      variant: "late",
    });
  }

  if (metrics.estimatedEarlyCount > 0) {
    chips.push({
      id: "early",
      label:
        metrics.estimatedEarlyCount === 1
          ? "1 early"
          : `${metrics.estimatedEarlyCount} early`,
      variant: "early",
    });
  }

  if (metrics.possibleGhostCount > 0) {
    chips.push({
      id: "ghost",
      label:
        metrics.possibleGhostCount === 1
          ? "1 ghost"
          : `${metrics.possibleGhostCount} ghosts`,
      variant: "ghost",
    });
  }

  if (showLargeGap) {
    chips.push({
      id: "gap",
      label: `${metrics.largestGapMinutes} min gap`,
      variant: "warning",
    });
  }

  let topWarning: string | null = null;
  if (metrics.possibleGhostCount > 0) {
    topWarning = `${metrics.possibleGhostCount} possible ghost${metrics.possibleGhostCount === 1 ? "" : "s"}`;
  } else if (metrics.estimatedLateCount > 0) {
    topWarning = `${metrics.estimatedLateCount} estimated late`;
  } else if (
    showLargeGap &&
    metrics.largestGapMinutes !== null
  ) {
    topWarning = `Largest gap ${metrics.largestGapMinutes} min`;
  } else if (metrics.liveVehicleCount === 0) {
    topWarning = "No live buses detected";
  }

  return {
    healthLabel: metrics.healthLabel,
    healthScore: metrics.healthScore,
    topWarning,
    chips,
  };
}
