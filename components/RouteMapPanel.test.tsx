import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteMapPanel } from "@/components/RouteMapPanel";
import { ROUTE_MAP_UNAVAILABLE_MESSAGE } from "@/lib/routeMapGeometry";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";

const locationMock: {
  status: "idle" | "locating" | "ready" | "error";
  position: { lat: number; lon: number } | null;
  nearestStop: null;
  nearestStopLabel: string | null;
  error: null;
  fitUserAndRouteSignal: number;
  centerOnUserSignal: number;
  enableLocation: ReturnType<typeof vi.fn>;
  findMe: ReturnType<typeof vi.fn>;
} = {
  status: "idle",
  position: null,
  nearestStop: null,
  nearestStopLabel: null,
  error: null,
  fitUserAndRouteSignal: 0,
  centerOnUserSignal: 0,
  enableLocation: vi.fn(),
  findMe: vi.fn(),
};

vi.mock("@/hooks/useMapUserLocation", () => ({
  useMapUserLocation: () => locationMock,
}));

vi.mock("@/components/RouteMapModal", () => ({
  RouteMapModal: ({
    onClose,
    onStopSelect,
  }: {
    onClose: () => void;
    onStopSelect?: (stop: NormalizedRoute["outbound"][number]) => void;
  }) => (
    <div role="dialog" aria-label="Interactive route map">
      <button
        type="button"
        onClick={() => onStopSelect?.(routeWithGeometry.outbound[0]!)}
      >
        View arrivals from map
      </button>
      <button type="button" onClick={onClose}>
        Close interactive map
      </button>
    </div>
  ),
}));

vi.mock("@/components/RouteLeafletMap", () => ({
  RouteLeafletMap: ({
    variant,
    ariaLabel,
  }: {
    variant?: string;
    ariaLabel: string;
  }) => <div role="region" aria-label={ariaLabel} data-variant={variant} />,
}));

const routeWithGeometry: NormalizedRoute = {
  routeId: "337",
  routeName: "337",
  outbound: [
    {
      id: "1",
      name: "Stop A",
      naptanId: "490000001A",
      lat: 51.46,
      lon: -0.21,
      isTimingPoint: false,
    },
    {
      id: "2",
      name: "Stop B",
      naptanId: "490000002B",
      lat: 51.47,
      lon: -0.2,
      isTimingPoint: false,
    },
  ],
  inbound: [],
};

const liveVehicle = {
  vehicleId: "337-562",
  routeNumber: "337",
  direction: "outbound",
  progress: 0.4,
  adherence: "onTime",
  markerState: "live",
  ghostStatus: "none",
  matched: true,
  missedRefreshCount: 0,
  scheduleStatus: "onTime",
  scheduleStatusLabel: "On time",
  scheduleDeviationMinutes: 0,
  scheduleMatchConfidence: "high",
  destinationName: "Richmond Bus Station",
  vehicleRegistration: "LV24EUK",
  ibusFleetNo: "3051",
  ibusRunningNo: "562",
  nextStop: { name: "Kings Road", naptanId: "490000001A" },
} as unknown as EstimatedVehiclePosition;

describe("RouteMapPanel", () => {
  beforeEach(() => {
    cleanup();
    locationMock.status = "idle";
    locationMock.position = null;
    locationMock.nearestStop = null;
    locationMock.nearestStopLabel = null;
    locationMock.error = null;
    locationMock.enableLocation = vi.fn();
    locationMock.findMe = vi.fn();
  });

  it("shows Use my location on the map preview and never Hide my location", async () => {
    render(
      <RouteMapPanel
        route={routeWithGeometry}
        direction="outbound"
        onDirectionChange={vi.fn()}
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        isMobile={false}
      />,
    );

    await screen.findByRole("region", {
      name: /Map preview for route 337/i,
    });
    expect(
      screen.getByRole("button", { name: /Use my location/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Hide my location/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Locating… while waiting for the first fix", async () => {
    locationMock.status = "locating";

    render(
      <RouteMapPanel
        route={routeWithGeometry}
        direction="outbound"
        onDirectionChange={vi.fn()}
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        isMobile={false}
      />,
    );

    expect(
      await screen.findByRole("button", { name: /Locating/i }),
    ).toBeDisabled();
  });

  it("shows the unavailable message when geometry is missing", () => {
    render(
      <RouteMapPanel
        route={{
          routeId: "999",
          routeName: "999",
          outbound: [
            {
              id: "1",
              name: "Stop A",
              naptanId: "490000001A",
              isTimingPoint: false,
            },
          ],
          inbound: [],
        }}
        direction="outbound"
        onDirectionChange={vi.fn()}
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        isMobile={false}
      />,
    );

    expect(screen.getByText(ROUTE_MAP_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
  });

  it("renders a compact Leaflet map without opening the map dialog", async () => {
    render(
      <RouteMapPanel
        route={routeWithGeometry}
        direction="outbound"
        onDirectionChange={vi.fn()}
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        isMobile={false}
      />,
    );

    const preview = await screen.findByRole("region", {
      name: /Map preview for route 337/i,
    });
    expect(preview).toHaveAttribute("data-variant", "preview");
    expect(
      screen.queryByRole("dialog", { name: /Interactive route map/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the interactive map when clicking the compact map", async () => {
    render(
      <RouteMapPanel
        route={routeWithGeometry}
        direction="outbound"
        onDirectionChange={vi.fn()}
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        isMobile={false}
      />,
    );

    expect(screen.queryByText("Open larger map")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Open larger map for route 337/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /Interactive route map/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", {
        name: /Open larger map for route 337/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("closes the interactive map cleanly", async () => {
    render(
      <RouteMapPanel
        route={routeWithGeometry}
        direction="outbound"
        onDirectionChange={vi.fn()}
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        isMobile={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Open larger map for route 337/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /Close interactive map/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Interactive route map/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps the large map mounted when opening stop arrivals", async () => {
    const onStopSelect = vi.fn();
    render(
      <RouteMapPanel
        route={routeWithGeometry}
        direction="outbound"
        onDirectionChange={vi.fn()}
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        onStopSelect={onStopSelect}
        isMobile={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Open larger map for route 337/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "View arrivals from map" }),
    );

    expect(onStopSelect).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("dialog", { name: /Interactive route map/i }),
    ).toBeInTheDocument();
  });

  it("keeps the accessible bus list collapsed by default", () => {
    render(
      <RouteMapPanel
        route={routeWithGeometry}
        direction="outbound"
        onDirectionChange={vi.fn()}
        vehicles={[liveVehicle]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        isMobile={false}
      />,
    );

    expect(screen.getByText(/Bus list \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/near Kings Road/i)).not.toBeVisible();
  });

  it("shows useful vehicle identity without repeating the route number", () => {
    render(
      <RouteMapPanel
        route={routeWithGeometry}
        direction="outbound"
        onDirectionChange={vi.fn()}
        vehicles={[liveVehicle]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        isMobile={false}
      />,
    );

    fireEvent.click(screen.getByText(/Bus list \(1\)/i));

    expect(
      screen.getByText("Run 562 · LV24EUK · Fleet 3051"),
    ).toBeInTheDocument();
    expect(screen.getByText(/On time · near Kings Road/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bus 337/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Run 562, LV24EUK, fleet 3051, on time, near Kings Road/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no buses for the direction", () => {
    render(
      <RouteMapPanel
        route={routeWithGeometry}
        direction="outbound"
        onDirectionChange={vi.fn()}
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        isMobile={false}
      />,
    );

    fireEvent.click(screen.getByText(/Bus list \(0\)/i));
    expect(
      screen.getByText(/No live buses to show for this direction right now/i),
    ).toBeInTheDocument();
  });

  it("selects a bus when its list row is tapped", async () => {
    const onVehicleSelect = vi.fn();
    render(
      <RouteMapPanel
        route={routeWithGeometry}
        direction="outbound"
        onDirectionChange={vi.fn()}
        vehicles={[liveVehicle]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={onVehicleSelect}
        isMobile={false}
      />,
    );

    fireEvent.click(screen.getByText(/Bus list \(1\)/i));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Run 562, LV24EUK, fleet 3051, on time, near Kings Road/i,
      }),
    );

    expect(onVehicleSelect).toHaveBeenCalledWith(liveVehicle);
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /Interactive route map/i }),
      ).toBeInTheDocument();
    });
  });

  it("does not re-enable timetable or add bulk iBus fetches in the map panel", () => {
    const panelSource = readFileSync(
      resolve(process.cwd(), "components/RouteMapPanel.tsx"),
      "utf8",
    );
    const listItemSource = readFileSync(
      resolve(process.cwd(), "components/MapVehicleListItem.tsx"),
      "utf8",
    );
    const helperSource = readFileSync(
      resolve(process.cwd(), "lib/mapVehicleList.ts"),
      "utf8",
    );

    for (const source of [panelSource, listItemSource, helperSource]) {
      expect(source).not.toContain("/api/tfl/timetable");
      expect(source).not.toContain("import:ibus");
      expect(source).not.toContain("readLocalRouteSchedule");
    }
  });
});

describe("RouteVisualModeToggle", () => {
  beforeEach(() => {
    cleanup();
  });

  it("shows Map, Loop, and List tabs in order", async () => {
    const { RouteVisualModeToggle } = await import(
      "@/components/RouteVisualModeToggle"
    );
    const onChange = vi.fn();

    render(<RouteVisualModeToggle mode="map" onChange={onChange} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Map", "Loop", "List"]);
    expect(screen.getByRole("tab", { name: "Map" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Loop" }));
    expect(onChange).toHaveBeenCalledWith("loop");
  });
});

describe("route map geometry helpers", () => {
  it("builds leaflet polyline coordinates from stop coordinates", async () => {
    const { getRoutePolylineLatLngs, computeLeafletBounds } = await import(
      "@/lib/routeMapGeometry"
    );

    const stops = routeWithGeometry.outbound.filter(
      (stop) => stop.lat !== undefined && stop.lon !== undefined,
    );

    expect(getRoutePolylineLatLngs(stops as never)).toEqual([
      [51.46, -0.21],
      [51.47, -0.2],
    ]);
    expect(computeLeafletBounds(stops as never)).not.toBeNull();
  });
});
