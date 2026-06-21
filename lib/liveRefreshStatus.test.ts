import { describe, expect, it } from "vitest";
import {
  buildLiveRefreshDisplay,
  formatNextRefreshInLabel,
  formatUpdatedAgoLabel,
  getLiveFreshnessLevel,
  getLiveStatusLabel,
  getRemainingRefetchIntervalMs,
  LIVE_REFRESH_STALE_AFTER_MS,
  LIVE_REFRESH_VERY_STALE_AFTER_MS,
  shouldRefetchOnVisibilityRestore,
} from "@/lib/liveRefreshStatus";
import { POLL_INTERVAL_MS } from "@/lib/storage";

const UPDATED_AT = 1_000_000;

describe("liveRefreshStatus", () => {
  it("formats updated ago and next refresh labels", () => {
    expect(formatUpdatedAgoLabel(UPDATED_AT, UPDATED_AT + 12_000)).toBe(
      "Updated 12s ago",
    );
    expect(
      formatNextRefreshInLabel(UPDATED_AT, UPDATED_AT + 12_000, 30_000),
    ).toBe("Auto-updates in 18s");
  });

  it("resets remaining refetch interval from last successful update", () => {
    expect(
      getRemainingRefetchIntervalMs(UPDATED_AT, UPDATED_AT + 2_000, 30_000),
    ).toBe(28_000);
    expect(
      getRemainingRefetchIntervalMs(UPDATED_AT, UPDATED_AT, 30_000),
    ).toBe(30_000);
  });

  it("classifies freshness levels", () => {
    expect(
      getLiveFreshnessLevel({
        dataUpdatedAt: UPDATED_AT,
        now: UPDATED_AT + 20_000,
        isError: false,
        staleAfterMs: LIVE_REFRESH_STALE_AFTER_MS,
        veryStaleAfterMs: LIVE_REFRESH_VERY_STALE_AFTER_MS,
      }),
    ).toBe("live");

    expect(
      getLiveFreshnessLevel({
        dataUpdatedAt: UPDATED_AT,
        now: UPDATED_AT + 62_000,
        isError: false,
        staleAfterMs: LIVE_REFRESH_STALE_AFTER_MS,
        veryStaleAfterMs: LIVE_REFRESH_VERY_STALE_AFTER_MS,
      }),
    ).toBe("soft-stale");

    expect(
      getLiveFreshnessLevel({
        dataUpdatedAt: UPDATED_AT,
        now: UPDATED_AT + 95_000,
        isError: false,
        staleAfterMs: LIVE_REFRESH_STALE_AFTER_MS,
        veryStaleAfterMs: LIVE_REFRESH_VERY_STALE_AFTER_MS,
      }),
    ).toBe("very-stale");

    expect(
      getLiveFreshnessLevel({
        dataUpdatedAt: UPDATED_AT,
        now: UPDATED_AT + 20_000,
        isError: true,
        staleAfterMs: LIVE_REFRESH_STALE_AFTER_MS,
        veryStaleAfterMs: LIVE_REFRESH_VERY_STALE_AFTER_MS,
      }),
    ).toBe("error");
  });

  it("builds normal live display without duplicate live label", () => {
    const display = buildLiveRefreshDisplay({
      dataUpdatedAt: UPDATED_AT,
      now: UPDATED_AT + 12_000,
      isFetching: false,
      isRefetching: false,
      isError: false,
    });

    expect(display.statusLabel).toBeNull();
    expect(display.updatedAgoLabel).toBe("Updated 12s ago");
    expect(display.nextRefreshLabel).toBe("Auto-updates in 18s");
    expect(display.refreshDisabled).toBe(false);
  });

  it("builds refreshing display without refresh button state", () => {
    const display = buildLiveRefreshDisplay({
      dataUpdatedAt: UPDATED_AT,
      now: UPDATED_AT + 28_000,
      isFetching: true,
      isRefetching: false,
      isError: false,
    });

    expect(display.statusLabel).toBe("Refreshing live data…");
    expect(display.updatedAgoLabel).toBe("Updated 28s ago");
    expect(display.nextRefreshLabel).toBeNull();
    expect(display.refreshDisabledReason).toBe("refreshing");
  });

  it("builds soft stale display", () => {
    const display = buildLiveRefreshDisplay({
      dataUpdatedAt: UPDATED_AT,
      now: UPDATED_AT + 62_000,
      isFetching: false,
      isRefetching: false,
      isError: false,
    });

    expect(display.statusLabel).toBe("Live data may be stale");
    expect(getLiveStatusLabel("soft-stale", false)).toBe(
      "Live data may be stale",
    );
  });

  it("builds error display with last update wording", () => {
    const display = buildLiveRefreshDisplay({
      dataUpdatedAt: UPDATED_AT,
      now: UPDATED_AT + 72_000,
      isFetching: false,
      isRefetching: false,
      isError: true,
    });

    expect(display.statusLabel).toBe("Could not refresh");
    expect(display.updatedAgoLabel).toBe(
      "showing last update from 72s ago",
    );
  });

  it("disables refresh during cooldown and hides auto countdown", () => {
    const display = buildLiveRefreshDisplay({
      dataUpdatedAt: UPDATED_AT,
      now: UPDATED_AT + 12_000,
      isFetching: false,
      isRefetching: false,
      isError: false,
      manualRefreshCooldownRemainingMs: 8_000,
    });

    expect(display.refreshDisabled).toBe(true);
    expect(display.refreshDisabledReason).toBe("cooldown");
    expect(display.cooldownLabel).toBe("Try again in 8s");
    expect(display.nextRefreshLabel).toBeNull();
  });

  it("refetches on visibility restore only when older than poll interval", () => {
    expect(
      shouldRefetchOnVisibilityRestore(
        UPDATED_AT,
        UPDATED_AT + POLL_INTERVAL_MS - 1,
      ),
    ).toBe(false);
    expect(
      shouldRefetchOnVisibilityRestore(
        UPDATED_AT,
        UPDATED_AT + POLL_INTERVAL_MS,
      ),
    ).toBe(true);
  });
});
