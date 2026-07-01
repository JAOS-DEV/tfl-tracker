import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteLeafletMap } from "@/components/RouteLeafletMap";
import type { EstimatedVehiclePosition, NormalizedRoute } from "@/lib/tfl/types";

const fitBounds = vi.fn();
const removeMap = vi.fn();
const markerOn = vi.fn().mockReturnThis();
const markerBindPopup = vi.fn().mockReturnThis();
const markerBindTooltip = vi.fn().mockReturnThis();
const markerOpenPopup = vi.fn();
const mapOn = vi.fn().mockReturnThis();
const mapOff = vi.fn().mockReturnThis();
const createMap = vi.fn<
  (element: HTMLElement, options: Record<string, unknown>) => typeof mapInstance
>(() => mapInstance);
const createDivIcon = vi.fn<
  (options: {
    className?: string;
    html?: string;
    iconSize?: [number, number];
  }) => object
>(() => ({}));

const mapInstance = {
  fitBounds,
  remove: removeMap,
  panTo: vi.fn(),
  getZoom: vi.fn(() => 15),
  on: mapOn,
  off: mapOff,
};

function removableLayer() {
  return {
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    clearLayers: vi.fn(),
  };
}

vi.mock("leaflet", () => ({
  map: createMap,
  tileLayer: vi.fn(() => removableLayer()),
  polyline: vi.fn(() => removableLayer()),
  layerGroup: vi.fn(() => removableLayer()),
  divIcon: createDivIcon,
  marker: vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    bindPopup: markerBindPopup,
    bindTooltip: markerBindTooltip,
    on: markerOn,
    openPopup: markerOpenPopup,
    getLatLng: vi.fn(() => ({ lat: 51.47, lng: -0.2 })),
  })),
}));

const route: NormalizedRoute = {
  routeId: "22",
  routeName: "22",
  outbound: [
    {
      id: "a",
      name: "Stop A",
      naptanId: "a",
      lat: 51.46,
      lon: -0.21,
      isTimingPoint: false,
    },
    {
      id: "b",
      name: "Stop B",
      naptanId: "b",
      lat: 51.47,
      lon: -0.2,
      isTimingPoint: false,
    },
  ],
  inbound: [],
};

function vehicle(progress: number): EstimatedVehiclePosition {
  return {
    vehicleId: "bus-22",
    routeNumber: "22",
    direction: "outbound",
    destinationName: "Oxford Circus",
    progress,
    adherence: "onTime",
    scheduleStatusLabel: "On time",
    ghostStatus: "normal",
    missedRefreshCount: 0,
  } as EstimatedVehiclePosition;
}

describe("RouteLeafletMap viewport", () => {
  beforeEach(() => {
    fitBounds.mockClear();
    removeMap.mockClear();
    createMap.mockClear();
    createDivIcon.mockClear();
    markerOn.mockClear();
    markerBindPopup.mockClear();
    markerBindTooltip.mockClear();
    markerOpenPopup.mockClear();
    mapOn.mockClear();
    mapOff.mockClear();
  });

  it("does not refit after live vehicle data refreshes", async () => {
    const view = render(
      <RouteLeafletMap
        route={route}
        direction="outbound"
        vehicles={[vehicle(0.3)]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        fitBoundsSignal={0}
        ariaLabel="Route 22 map"
      />,
    );

    await waitFor(() => expect(fitBounds).toHaveBeenCalled());
    const initialFitCount = fitBounds.mock.calls.length;

    view.rerender(
      <RouteLeafletMap
        route={route}
        direction="outbound"
        vehicles={[vehicle(0.6)]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        fitBoundsSignal={0}
        ariaLabel="Route 22 map"
      />,
    );

    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(initialFitCount));
  });

  it("refits when the explicit fit signal changes", async () => {
    const commonProps = {
      route,
      direction: "outbound" as const,
      vehicles: [vehicle(0.3)],
      selectedVehicleId: null,
      loopLabelSettings: {
        showRegistration: true,
        showFleetNumber: true,
        showRunningNumber: true,
      },
      onVehicleSelect: vi.fn(),
      ariaLabel: "Route 22 map",
    };
    const view = render(<RouteLeafletMap {...commonProps} fitBoundsSignal={0} />);

    await waitFor(() => expect(fitBounds).toHaveBeenCalled());
    const initialFitCount = fitBounds.mock.calls.length;
    view.rerender(<RouteLeafletMap {...commonProps} fitBoundsSignal={1} />);

    await waitFor(() =>
      expect(fitBounds).toHaveBeenCalledTimes(initialFitCount + 1),
    );
  });

  it("creates a non-interactive compact map with direction arrows", async () => {
    render(
      <RouteLeafletMap
        route={route}
        direction="outbound"
        vehicles={[vehicle(0.3)]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        variant="preview"
        ariaLabel="Route 22 map preview"
      />,
    );

    await waitFor(() => expect(createMap).toHaveBeenCalled());
    expect(createMap.mock.calls[0]?.[1]).toMatchObject({
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      keyboard: false,
    });
    await waitFor(() =>
      expect(
        createDivIcon.mock.calls.some((call) =>
          String(call[0]?.html).includes("route-map-direction-arrow"),
        ),
      ).toBe(true),
    );
    const directionIcon = createDivIcon.mock.calls.find((call) =>
      String(call[0]?.html).includes("route-map-direction-arrow"),
    );
    expect(directionIcon?.[0].iconSize).toEqual([22, 22]);
  });

  it("keeps marker clicks in the Leaflet popup until Full info is chosen", async () => {
    const onVehicleSelect = vi.fn();
    const view = render(
      <RouteLeafletMap
        route={route}
        direction="outbound"
        vehicles={[vehicle(0.3)]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={onVehicleSelect}
        ariaLabel="Route 22 map"
      />,
    );

    await waitFor(() => expect(fitBounds).toHaveBeenCalled());
    expect(markerOn).not.toHaveBeenCalledWith("click", expect.any(Function));

    const action = document.createElement("button");
    action.dataset.vehicleAction = "full-info";
    action.dataset.vehicleId = "bus-22";
    view.container.querySelector('[role="region"]')!.append(action);
    fireEvent.click(action);

    expect(onVehicleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: "bus-22" }),
    );
  });

  it("opens the bus popup when its visible label is clicked", async () => {
    const view = render(
      <RouteLeafletMap
        route={route}
        direction="outbound"
        vehicles={[vehicle(0.3)]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        ariaLabel="Clickable vehicle labels map"
      />,
    );

    await waitFor(() => expect(markerBindTooltip).toHaveBeenCalled());
    const label = document.createElement("button");
    label.dataset.vehiclePopupId = "bus-22";
    view.container.querySelector('[role="region"]')!.append(label);
    fireEvent.click(label);

    expect(markerOpenPopup).toHaveBeenCalled();
  });

  it("opens full bus info when the popup content is clicked", async () => {
    const onVehicleSelect = vi.fn();
    const view = render(
      <RouteLeafletMap
        route={route}
        direction="outbound"
        vehicles={[vehicle(0.3)]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={onVehicleSelect}
        ariaLabel="Route 22 map"
      />,
    );

    await waitFor(() => expect(fitBounds).toHaveBeenCalled());

    const popup = document.createElement("button");
    popup.className = "route-map-stop-action";
    popup.dataset.vehicleAction = "full-info";
    popup.dataset.vehicleId = "bus-22";
    popup.textContent = "Full info";
    view.container.querySelector('[role="region"]')!.append(popup);
    fireEvent.click(popup);

    expect(onVehicleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: "bus-22" }),
    );
  });

  it("assigns distinct popup themes to stops and buses", async () => {
    render(
      <RouteLeafletMap
        route={route}
        direction="outbound"
        vehicles={[vehicle(0.3)]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        ariaLabel="Route 22 map"
      />,
    );

    await waitFor(() => expect(markerBindPopup).toHaveBeenCalled());
    expect(markerBindPopup.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.stringContaining("Stop A"),
          expect.objectContaining({ className: "route-map-leaflet-popup route-map-stop-popup" }),
        ],
        [
          expect.stringContaining("Route 22"),
          expect.objectContaining({ className: "route-map-leaflet-popup route-map-bus-popup" }),
        ],
      ]),
    );
  });

  it("keeps stop labels right of markers and vehicle labels clear on the left", async () => {
    render(
      <RouteLeafletMap
        route={route}
        direction="outbound"
        vehicles={[vehicle(0.3)]}
        selectedVehicleId={null}
        loopLabelSettings={{
          showRegistration: true,
          showFleetNumber: true,
          showRunningNumber: true,
        }}
        onVehicleSelect={vi.fn()}
        ariaLabel="Route 22 map"
      />,
    );

    await waitFor(() => expect(markerBindTooltip).toHaveBeenCalled());
    expect(markerBindTooltip.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.stringContaining("Stop A"),
          expect.objectContaining({ direction: "right", offset: [8, 0] }),
        ],
        [
          expect.stringContaining("Route 22"),
          expect.objectContaining({
            direction: "left",
            offset: [-18, 0],
            interactive: true,
          }),
        ],
      ]),
    );
    expect(mapOn).toHaveBeenCalledWith("zoomend", expect.any(Function));
    expect(
      document.querySelector('[aria-label="Route 22 map"]'),
    ).toHaveClass("route-map-show-vehicle-labels");
  });

  it("opens the stop popup when its visible name label is clicked", async () => {
    const view = render(
      <RouteLeafletMap
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
        ariaLabel="Clickable stop labels map"
      />,
    );

    await waitFor(() => expect(markerBindTooltip).toHaveBeenCalled());
    const label = document.createElement("button");
    label.dataset.stopPopupId = "a";
    view.container.querySelector('[role="region"]')!.append(label);
    fireEvent.click(label);

    expect(markerOpenPopup).toHaveBeenCalled();
  });
});
