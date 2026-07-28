import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteMapModal } from "@/components/RouteMapModal";
import type { UseMapUserLocationResult } from "@/hooks/useMapUserLocation";
import type { NormalizedRoute } from "@/lib/tfl/types";

vi.mock("@/components/RouteLeafletMap", () => ({
  RouteLeafletMap: ({
    ariaLabel,
  }: {
    ariaLabel: string;
  }) => <div role="region" aria-label={ariaLabel} />,
}));

const route: NormalizedRoute = {
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

function createLocationMock(
  overrides: Partial<UseMapUserLocationResult> = {},
): UseMapUserLocationResult {
  return {
    status: "idle",
    position: null,
    nearestStop: null,
    nearestStopLabel: null,
    error: null,
    fitUserAndRouteSignal: 0,
    centerOnUserSignal: 0,
    enableLocation: vi.fn(),
    findMe: vi.fn(),
    ...overrides,
  };
}

describe("RouteMapModal", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders an accessible route map dialog with fit route control", async () => {
    render(
      <RouteMapModal
        route={route}
        direction="outbound"
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        onDirectionChange={vi.fn()}
        onClose={vi.fn()}
        isMobile={false}
        location={createLocationMock()}
        highlightedStopId={null}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: /Route 337 map/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Fit route/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Use my location/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Hide my location/i }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("region", {
          name: /Interactive map for route 337, outbound direction/i,
        }),
      ).toBeInTheDocument();
    });
  });

  it("shows Find me when location is ready", () => {
    render(
      <RouteMapModal
        route={route}
        direction="outbound"
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        onDirectionChange={vi.fn()}
        onClose={vi.fn()}
        isMobile={false}
        location={createLocationMock({
          status: "ready",
          position: { lat: 51.46, lon: -0.21 },
          nearestStop: {
            stop: {
              id: "1",
              name: "Stop A",
              naptanId: "490000001A",
              lat: 51.46,
              lon: -0.21,
              isTimingPoint: false,
            },
            distanceMetres: 12,
          },
          nearestStopLabel: "Nearest stop: Stop A · 12 m",
        })}
        highlightedStopId="490000001A"
      />,
    );

    expect(screen.getByRole("button", { name: /Find me/i })).toBeInTheDocument();
    expect(screen.getByText("12 m")).toBeInTheDocument();
    expect(screen.getByText("Stop A")).toBeInTheDocument();
    expect(screen.getByText(/Nearest stop/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Hide my location/i }),
    ).not.toBeInTheDocument();
  });

  it("closes when the close button is clicked", () => {
    const onClose = vi.fn();

    render(
      <RouteMapModal
        route={route}
        direction="outbound"
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        onDirectionChange={vi.fn()}
        onClose={onClose}
        isMobile={false}
        location={createLocationMock()}
        highlightedStopId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Close route map/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("switches route direction without closing the map", () => {
    const onDirectionChange = vi.fn();

    render(
      <RouteMapModal
        route={route}
        direction="outbound"
        vehicles={[]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        onDirectionChange={onDirectionChange}
        onClose={vi.fn()}
        isMobile={false}
        location={createLocationMock()}
        highlightedStopId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Towards Inbound" }));
    expect(onDirectionChange).toHaveBeenCalledWith("inbound");
    expect(screen.getByRole("dialog", { name: /Route 337 map/i })).toBeInTheDocument();
  });
});
