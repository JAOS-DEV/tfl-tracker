"use client";

import { useCallback } from "react";
import { useLiveRefreshClock } from "@/hooks/useLiveRefreshClock";
import { useManualRefreshCooldown } from "@/hooks/useManualRefreshCooldown";
import {
  buildLiveRefreshDisplay,
  LIVE_REFRESH_MANUAL_COOLDOWN_MS,
  LIVE_REFRESH_STALE_AFTER_MS,
  LIVE_REFRESH_VERY_STALE_AFTER_MS,
} from "@/lib/liveRefreshStatus";
import { POLL_INTERVAL_MS } from "@/lib/storage";

interface LiveRefreshStatusProps {
  routeId: string;
  dataUpdatedAt?: number;
  isFetching: boolean;
  isRefetching: boolean;
  isError?: boolean;
  refetchIntervalMs?: number;
  staleAfterMs?: number;
  veryStaleAfterMs?: number;
  manualRefreshCooldownMs?: number;
  compact?: boolean;
  onRefresh: () => void | Promise<unknown>;
}

export function LiveRefreshStatus({
  routeId,
  dataUpdatedAt,
  isFetching,
  isRefetching,
  isError = false,
  refetchIntervalMs = POLL_INTERVAL_MS,
  staleAfterMs = LIVE_REFRESH_STALE_AFTER_MS,
  veryStaleAfterMs = LIVE_REFRESH_VERY_STALE_AFTER_MS,
  manualRefreshCooldownMs = LIVE_REFRESH_MANUAL_COOLDOWN_MS,
  compact = false,
  onRefresh,
}: LiveRefreshStatusProps): React.ReactElement {
  const now = useLiveRefreshClock(Boolean(dataUpdatedAt));
  const { cooldownRemainingMs, triggerCooldown, isOnCooldown } =
    useManualRefreshCooldown(manualRefreshCooldownMs);

  const display = buildLiveRefreshDisplay({
    dataUpdatedAt,
    now,
    isFetching,
    isRefetching,
    isError,
    refetchIntervalMs,
    staleAfterMs,
    veryStaleAfterMs,
    manualRefreshCooldownRemainingMs: isOnCooldown ? cooldownRemainingMs : 0,
  });

  const handleRefresh = useCallback(() => {
    if (display.refreshDisabled) {
      return;
    }
    triggerCooldown();
    void onRefresh();
  }, [display.refreshDisabled, onRefresh, triggerCooldown]);

  const refreshAriaLabel = display.refreshDisabled
    ? display.refreshButtonLabel
    : `Refresh live data for route ${routeId}`;

  return (
    <div
      className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-zinc-200/80 pt-2 text-[11px] text-zinc-500 sm:text-xs dark:border-zinc-800/80 dark:text-zinc-400"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        {display.statusLabel ? (
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            {display.statusLabel}
          </span>
        ) : null}

        {display.updatedAgoLabel ? (
          <span aria-hidden="true" className="tabular-nums">
            {display.updatedAgoLabel}
          </span>
        ) : null}

        {!compact && display.nextRefreshLabel ? (
          <span
            aria-hidden="true"
            className="hidden tabular-nums text-zinc-400 sm:inline"
          >
            {display.nextRefreshLabel}
          </span>
        ) : null}
      </div>

      <div className="shrink-0">
        {display.cooldownLabel ? (
          <span
            aria-hidden="true"
            className="tabular-nums text-zinc-400"
          >
            {display.cooldownLabel}
          </span>
        ) : display.refreshDisabledReason === "refreshing" ? (
          <span className="font-medium text-zinc-400">Refreshing…</span>
        ) : (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={display.refreshDisabled}
            aria-label={refreshAriaLabel}
            className="min-h-8 rounded-md border border-zinc-300 px-2.5 py-1 font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}
