import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteMapPanel } from "@/components/RouteMapPanel";
import { ROUTE_MAP_UNAVAILABLE_MESSAGE } from "@/lib/routeMapGeometry";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";

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
  destinationName: "Richmond Bus Station",
  vehicleRegistration: "LV24EUK",
  ibusRunningNo: "562",
  nextStop: { name: "Kings Road", naptanId: "490000001A" },
} as unknown as EstimatedVehiclePosition;

describe("RouteMapPanel", () => {
  beforeEach(() => {
    cleanup();
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
