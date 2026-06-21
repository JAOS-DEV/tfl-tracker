import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteSearch } from "@/components/RouteSearch";
import {
  VEHICLE_SEARCH_HELP_TEXT,
  VEHICLE_SEARCH_PLACEHOLDER,
} from "@/lib/vehicleSearch";

const fetchMock = vi.fn();

vi.mock("@/hooks/useActiveVehicleSearchCandidates", () => ({
  useActiveVehicleSearchCandidates: () => [],
}));

function renderRouteSearch(
  activeRoutes: Array<{ routeId: string; routeName: string; addedAt: number }> = [],
): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouteSearch
        activeRoutes={activeRoutes}
        recentRoutes={[]}
        favouriteRoutes={[]}
        favouriteStops={[]}
        onActiveRoutesChange={vi.fn()}
        onRecentRoutesChange={vi.fn()}
        onRemoveFavouriteRoute={vi.fn()}
        onToggleFavouriteRoute={vi.fn()}
        onToggleFavouriteStop={vi.fn()}
        onRemoveFavouriteStop={vi.fn()}
        onOpenStop={vi.fn()}
        onOpenVehicleSearchResult={vi.fn()}
        isFavouriteRoute={() => false}
        isFavouriteStop={() => false}
      />
    </QueryClientProvider>,
  );
}

function textAcrossNodes(expected: string) {
  return (_content: string, node: Element | null): boolean =>
    node?.textContent === expected;
}

describe("RouteSearch vehicle guidance", () => {
  beforeEach(() => {
    cleanup();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("shows placeholder and help text about active-route vehicle search", () => {
    renderRouteSearch();

    expect(
      screen.getByPlaceholderText(VEHICLE_SEARCH_PLACEHOLDER),
    ).toBeInTheDocument();
    expect(screen.getByText(VEHICLE_SEARCH_HELP_TEXT)).toBeInTheDocument();
  });

  it("shows a helpful empty state for running queries with no active routes", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    renderRouteSearch();

    fireEvent.change(
      screen.getByPlaceholderText(VEHICLE_SEARCH_PLACEHOLDER),
      { target: { value: "562" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByText(/Open a route first to search live vehicles/i),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("timetable"))).toBe(
      false,
    );
  });

  it("shows a helpful empty state for registration queries with no active routes", async () => {
    renderRouteSearch();

    fireEvent.change(
      screen.getByPlaceholderText(VEHICLE_SEARCH_PLACEHOLDER),
      { target: { value: "LV24EUK" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByText(/Open a route first to search live vehicles/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a helpful empty state for fleet queries with no active routes", async () => {
    renderRouteSearch();

    fireEvent.change(
      screen.getByPlaceholderText(VEHICLE_SEARCH_PLACEHOLDER),
      { target: { value: "WHV119" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(
      await screen.findByText(/Open a route first to search live vehicles/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still performs route search without bulk vehicle scanning", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: "14", name: "14 to Putney Heath", modeName: "bus" }],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    renderRouteSearch();

    fireEvent.change(
      screen.getByPlaceholderText(VEHICLE_SEARCH_PLACEHOLDER),
      { target: { value: "14" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/tfl/line-search");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/api/tfl/stop-search");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("timetable"))).toBe(
      false,
    );
    expect(await screen.findByText(textAcrossNodes("Routes (1)"))).toBeInTheDocument();
  });

  it("still performs stop search for location queries", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            stopPointId: "490000001A",
            name: "Richmond Station",
            stopLetter: "A",
            routesServed: ["337"],
          },
        ],
      }),
    });

    renderRouteSearch();

    fireEvent.change(
      screen.getByPlaceholderText(VEHICLE_SEARCH_PLACEHOLDER),
      { target: { value: "Richmond" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText(textAcrossNodes("Stops (1)"))).toBeInTheDocument();
  });
});
