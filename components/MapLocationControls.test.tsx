import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("shows a prominent nearest-stop distance card when ready", () => {
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
    expect(screen.getByText(/to Clapham Junction/i)).toBeInTheDocument();
    expect(screen.getByText(/Nearest stop on this route/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Find me/i }));
  });
});
