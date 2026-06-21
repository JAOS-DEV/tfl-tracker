import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveRefreshStatus } from "@/components/LiveRefreshStatus";
import { LIVE_REFRESH_MANUAL_COOLDOWN_MS } from "@/lib/liveRefreshStatus";

describe("LiveRefreshStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T12:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows updated and auto-update labels without duplicate live chip text", () => {
    const dataUpdatedAt = Date.now() - 12_000;

    render(
      <LiveRefreshStatus
        routeId="337"
        dataUpdatedAt={dataUpdatedAt}
        isFetching={false}
        isRefetching={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.queryByText("Live now")).not.toBeInTheDocument();
    expect(screen.getByText("Updated 12s ago")).toBeInTheDocument();
    expect(screen.getByText("Auto-updates in 18s")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh live data for route 337" }),
    ).toBeInTheDocument();
  });

  it("shows refreshing state without refresh button", () => {
    render(
      <LiveRefreshStatus
        routeId="337"
        dataUpdatedAt={Date.now() - 28_000}
        isFetching={true}
        isRefetching={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Refreshing live data…")).toBeInTheDocument();
    expect(screen.getByText("Updated 28s ago")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Refresh live data for route 337/i }),
    ).not.toBeInTheDocument();
  });

  it("shows stale warning after threshold", () => {
    render(
      <LiveRefreshStatus
        routeId="337"
        dataUpdatedAt={Date.now() - 62_000}
        isFetching={false}
        isRefetching={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Live data may be stale")).toBeInTheDocument();
    expect(screen.getByText("Updated 62s ago")).toBeInTheDocument();
  });

  it("calls route-scoped refresh handler once per click", async () => {
    vi.useRealTimers();
    cleanup();
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    render(
      <LiveRefreshStatus
        routeId="337"
        dataUpdatedAt={Date.now() - 12_000}
        isFetching={false}
        isRefetching={false}
        onRefresh={onRefresh}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Refresh live data for route 337" }),
    );

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows manual cooldown without auto-update countdown", async () => {
    vi.useRealTimers();
    cleanup();
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    render(
      <LiveRefreshStatus
        routeId="337"
        dataUpdatedAt={Date.now() - 12_000}
        isFetching={false}
        isRefetching={false}
        manualRefreshCooldownMs={12_000}
        onRefresh={onRefresh}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Refresh live data for route 337" }),
    );

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(screen.getByText(/Try again in \d+s/)).toBeInTheDocument();
    expect(screen.queryByText(/Auto-updates in/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Refresh live data for route 337/i }),
    ).not.toBeInTheDocument();
  });

  it("shows compact layout without auto-update label", () => {
    render(
      <LiveRefreshStatus
        routeId="337"
        dataUpdatedAt={Date.now() - 12_000}
        isFetching={false}
        isRefetching={false}
        compact
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Auto-updates in/i)).not.toBeInTheDocument();
    expect(screen.getByText("Updated 12s ago")).toBeInTheDocument();
  });

  it("shows error state with last update wording", () => {
    render(
      <LiveRefreshStatus
        routeId="337"
        dataUpdatedAt={Date.now() - 72_000}
        isFetching={false}
        isRefetching={false}
        isError
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Could not refresh")).toBeInTheDocument();
    expect(
      screen.getByText("showing last update from 72s ago"),
    ).toBeInTheDocument();
  });

  it("does not call refresh repeatedly on timer ticks", () => {
    const onRefresh = vi.fn();

    render(
      <LiveRefreshStatus
        routeId="337"
        dataUpdatedAt={Date.now() - 12_000}
        isFetching={false}
        isRefetching={false}
        onRefresh={onRefresh}
      />,
    );

    vi.advanceTimersByTime(LIVE_REFRESH_MANUAL_COOLDOWN_MS);

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
