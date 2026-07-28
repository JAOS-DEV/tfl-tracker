import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapLocationControls } from "@/components/MapLocationControls";
import type { UseMapUserLocationResult } from "@/hooks/useMapUserLocation";

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

describe("MapLocationControls", () => {
  beforeEach(() => {
    cleanup();
  });

  it("shows a compact nearest-stop distance beside Find me", () => {
    render(
      <MapLocationControls
        location={createLocationMock({
          status: "ready",
          position: { lat: 51.5, lon: -0.1 },
          nearestStop: {
            stop: {
              id: "1",
              name: "Clapham Junction",
              naptanId: "A",
              lat: 51.5,
              lon: -0.1,
              isTimingPoint: false,
            },
            distanceMetres: 240,
          },
          nearestStopLabel: "Nearest stop: Clapham Junction · 240 m",
        })}
      />,
    );

    expect(screen.getByText("240 m")).toBeInTheDocument();
    expect(screen.getByText("Clapham Junction")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Find me/i })).toBeInTheDocument();
  });

  it("hides Find me when showFindMe is false", () => {
    render(
      <MapLocationControls
        showFindMe={false}
        location={createLocationMock({
          status: "ready",
          position: { lat: 51.5, lon: -0.1 },
          nearestStop: {
            stop: {
              id: "1",
              name: "Clapham Junction",
              naptanId: "A",
              lat: 51.5,
              lon: -0.1,
              isTimingPoint: false,
            },
            distanceMetres: 240,
          },
          nearestStopLabel: "Nearest stop: Clapham Junction · 240 m",
        })}
      />,
    );

    expect(screen.getByText("240 m")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Find me/i }),
    ).not.toBeInTheDocument();
  });
});
