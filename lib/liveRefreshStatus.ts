import { POLL_INTERVAL_MS } from "@/lib/storage";

export const LIVE_REFRESH_STALE_AFTER_MS = 45_000;
export const LIVE_REFRESH_VERY_STALE_AFTER_MS = 90_000;
export const LIVE_REFRESH_MANUAL_COOLDOWN_MS = 12_000;

export type LiveFreshnessLevel = "live" | "soft-stale" | "very-stale" | "error";

export interface LiveRefreshDisplayInput {
  dataUpdatedAt?: number;
  now: number;
  isFetching: boolean;
  isRefetching: boolean;
  isError: boolean;
  refetchIntervalMs?: number;
  staleAfterMs?: number;
  veryStaleAfterMs?: number;
  manualRefreshCooldownRemainingMs?: number;
}

export interface LiveRefreshDisplay {
  freshnessLevel: LiveFreshnessLevel;
  statusLabel: string | null;
  updatedAgoLabel: string | null;
  nextRefreshLabel: string | null;
  refreshDisabled: boolean;
  refreshDisabledReason: "refreshing" | "cooldown" | null;
  cooldownLabel: string | null;
  refreshButtonLabel: string;
}

export function getAgeMs(
  dataUpdatedAt: number | undefined,
  now: number,
): number | null {
  if (!dataUpdatedAt || dataUpdatedAt <= 0) {
    return null;
  }
  return Math.max(0, now - dataUpdatedAt);
}

export function formatSecondsAgo(ageMs: number): string {
  const seconds = Math.max(1, Math.floor(ageMs / 1000));
  return `${seconds}s ago`;
}

export function formatUpdatedAgoLabel(
  dataUpdatedAt: number | undefined,
  now: number,
): string | null {
  const ageMs = getAgeMs(dataUpdatedAt, now);
  if (ageMs === null) {
    return null;
  }
  return `Updated ${formatSecondsAgo(ageMs)}`;
}

export function getRemainingRefetchIntervalMs(
  dataUpdatedAt: number | undefined,
  now: number,
  refetchIntervalMs: number,
): number {
  const ageMs = getAgeMs(dataUpdatedAt, now);
  if (ageMs === null) {
    return refetchIntervalMs;
  }
  const remainingMs = refetchIntervalMs - ageMs;
  if (remainingMs <= 0) {
    return refetchIntervalMs;
  }
  return remainingMs;
}

export function formatNextRefreshInLabel(
  dataUpdatedAt: number | undefined,
  now: number,
  refetchIntervalMs: number,
): string | null {
  const ageMs = getAgeMs(dataUpdatedAt, now);
  if (ageMs === null) {
    return null;
  }
  const remainingMs = getRemainingRefetchIntervalMs(
    dataUpdatedAt,
    now,
    refetchIntervalMs,
  );
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return `Auto-updates in ${seconds}s`;
}

export function getLiveFreshnessLevel(input: {
  dataUpdatedAt?: number;
  now: number;
  isError: boolean;
  staleAfterMs: number;
  veryStaleAfterMs: number;
}): LiveFreshnessLevel {
  if (input.isError) {
    return "error";
  }

  const ageMs = getAgeMs(input.dataUpdatedAt, input.now);
  if (ageMs === null) {
    return "live";
  }
  if (ageMs >= input.veryStaleAfterMs) {
    return "very-stale";
  }
  if (ageMs >= input.staleAfterMs) {
    return "soft-stale";
  }
  return "live";
}

export function getLiveStatusLabel(
  level: LiveFreshnessLevel,
  isRefreshing: boolean,
): string {
  if (isRefreshing) {
    return "Refreshing live data…";
  }

  switch (level) {
    case "live":
      return "Live now";
    case "soft-stale":
      return "Live data may be stale";
    case "very-stale":
      return "Live data stale";
    case "error":
      return "Could not refresh";
  }
}

export function shouldRefetchOnVisibilityRestore(
  dataUpdatedAt: number | undefined,
  now: number,
  refetchIntervalMs: number = POLL_INTERVAL_MS,
): boolean {
  const ageMs = getAgeMs(dataUpdatedAt, now);
  if (ageMs === null) {
    return false;
  }
  return ageMs >= refetchIntervalMs;
}

export function buildLiveRefreshDisplay(
  input: LiveRefreshDisplayInput,
): LiveRefreshDisplay {
  const refetchIntervalMs = input.refetchIntervalMs ?? POLL_INTERVAL_MS;
  const staleAfterMs = input.staleAfterMs ?? LIVE_REFRESH_STALE_AFTER_MS;
  const veryStaleAfterMs = input.veryStaleAfterMs ?? LIVE_REFRESH_VERY_STALE_AFTER_MS;
  const isRefreshing = input.isFetching || input.isRefetching;
  const cooldownRemainingMs = input.manualRefreshCooldownRemainingMs ?? 0;
  const isOnCooldown = cooldownRemainingMs > 0;

  const freshnessLevel = getLiveFreshnessLevel({
    dataUpdatedAt: input.dataUpdatedAt,
    now: input.now,
    isError: input.isError,
    staleAfterMs,
    veryStaleAfterMs,
  });

  const statusLabel = getLiveStatusLabel(freshnessLevel, isRefreshing);
  const showStatusLabel =
    isRefreshing || freshnessLevel !== "live";
  const updatedAgoLabel = formatUpdatedAgoLabel(input.dataUpdatedAt, input.now);

  let nextRefreshLabel: string | null = null;
  if (
    !isRefreshing &&
    !isOnCooldown &&
    (freshnessLevel === "live" || freshnessLevel === "soft-stale")
  ) {
    nextRefreshLabel = formatNextRefreshInLabel(
      input.dataUpdatedAt,
      input.now,
      refetchIntervalMs,
    );
  }

  let refreshDisabledReason: LiveRefreshDisplay["refreshDisabledReason"] = null;
  if (isRefreshing) {
    refreshDisabledReason = "refreshing";
  } else if (isOnCooldown) {
    refreshDisabledReason = "cooldown";
  }

  const cooldownSeconds = Math.max(1, Math.ceil(cooldownRemainingMs / 1000));
  const cooldownLabel = isOnCooldown ? `Try again in ${cooldownSeconds}s` : null;

  return {
    freshnessLevel,
    statusLabel: showStatusLabel ? statusLabel : null,
    updatedAgoLabel:
      freshnessLevel === "error" && updatedAgoLabel
        ? `showing last update from ${formatSecondsAgo(getAgeMs(input.dataUpdatedAt, input.now) ?? 0)}`
        : updatedAgoLabel,
    nextRefreshLabel,
    refreshDisabled: refreshDisabledReason !== null,
    refreshDisabledReason,
    cooldownLabel,
    refreshButtonLabel: isRefreshing ? "Refreshing…" : "Refresh",
  };
}
