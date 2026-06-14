import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MultiRouteDashboard } from "@/components/MultiRouteDashboard";
import { DEFAULT_DISPLAY_SETTINGS } from "@/lib/displaySettings";
import type { ActiveRoute } from "@/lib/tfl/types";

const useActiveRouteIntelligencesMock = vi.fn<
  (routes: unknown, options: unknown) => unknown[]
>(() => []);

vi.mock("@/hooks/useRouteIntelligence", () => ({
  useActiveRouteIntelligences: (routesArg: unknown, optionsArg: unknown) =>
    useActiveRouteIntelligencesMock(routesArg, optionsArg),
}));

vi.mock("@/components/MultiRouteHistoryComparison", () => ({
  MultiRouteHistoryComparison: () => <div>history comparison mounted</div>,
}));

const routes: ActiveRoute[] = [
  { routeId: "337", routeName: "337", addedAt: 1 },
  { routeId: "14", routeName: "14", addedAt: 2 },
];

describe("MultiRouteDashboard", () => {
  it("keeps history comparison and heavy route intelligence out of normal mode", () => {
    render(
      <MultiRouteDashboard
        activeRoutes={routes}
        alertPreferences={{}}
        displaySettings={{
          ...DEFAULT_DISPLAY_SETTINGS,
          showAdvancedDiagnostics: false,
        }}
      />,
    );

    expect(screen.queryByText("history comparison mounted")).not.toBeInTheDocument();
    expect(useActiveRouteIntelligencesMock).toHaveBeenCalledWith(routes, {
      includeScheduleMatching: false,
      fetchTimetable: false,
      showScheduleGhosts: false,
      includeLowConfidenceScheduleGhosts: false,
      enrichLiveIbusDetails: false,
    });
  });
});
