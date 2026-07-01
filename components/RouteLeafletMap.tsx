"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoopMarkerLabelSettings } from "@/components/LoopMarkerInfoBadges";
import { getGhostMarkerIconText, isPossibleGhostBus } from "@/lib/ghostDisplay";
import { getMapTileConfig } from "@/lib/mapTiles";
import {
  buildRouteMapVehicleMarkers,
  buildRouteDirectionMarkers,
  computeLeafletBounds,
  getGeographicStops,
  getRoutePolylinePathsLatLngs,
  getRoutePolylinePoints,
} from "@/lib/routeMapGeometry";
import {
  buildBusMarkerHtml,
  buildDirectionArrowHtml,
  buildStopMarkerHtml,
  getLeafletMarkerColors,
  getLeafletMarkerOpacity,
  getMapVehicleBadge,
} from "@/lib/routeMapLeafletStyles";
import {
  buildBusPopupWithActionHtml,
  buildStopMapLabelHtml,
  buildStopPopupWithActionHtml,
  buildVehicleMapLabelHtml,
} from "@/lib/routeMapPopups";
import type {
  EstimatedVehiclePosition,
  NormalizedRoute,
  NormalizedStop,
  RouteDirection,
} from "@/lib/tfl/types";
import type { LayerGroup, Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";

interface RouteLeafletMapProps {
  route: NormalizedRoute;
  direction: RouteDirection;
  vehicles: EstimatedVehiclePosition[];
  selectedVehicleId: string | null;
  loopLabelSettings: LoopMarkerLabelSettings;
  onVehicleSelect: (vehicle: EstimatedVehiclePosition) => void;
  onStopSelect?: (stop: NormalizedStop) => void;
  fitBoundsSignal?: number;
  className?: string;
  ariaLabel: string;
  variant?: "preview" | "full";
}

export const RouteLeafletMap = memo(function RouteLeafletMap({
  route,
  direction,
  vehicles,
  selectedVehicleId,
  loopLabelSettings,
  onVehicleSelect,
  onStopSelect,
  fitBoundsSignal = 0,
  className,
  ariaLabel,
  variant = "full",
}: RouteLeafletMapProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<{
    polyline: Polyline | null;
    stops: LayerGroup | null;
    buses: LayerGroup | null;
    directions: LayerGroup | null;
    busMarkersById: Map<string, Marker>;
    stopMarkersById: Map<string, Marker>;
  }>({
    polyline: null,
    stops: null,
    buses: null,
    directions: null,
    busMarkersById: new Map(),
    stopMarkersById: new Map(),
  });
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const isPreview = variant === "preview";

  const geographicStops = useMemo(
    () => getGeographicStops(route, direction),
    [route, direction],
  );
  const vehicleMarkers = useMemo(
    () => buildRouteMapVehicleMarkers(vehicles, route, direction),
    [vehicles, route, direction],
  );
  const routePolylinePoints = useMemo(
    () => getRoutePolylinePoints(route, direction),
    [route, direction],
  );
  const routePolylineLatLngs = useMemo(
    () => getRoutePolylinePathsLatLngs(route, direction),
    [route, direction],
  );
  const directionMarkers = useMemo(
    () => buildRouteDirectionMarkers(routePolylineLatLngs, isPreview ? 3 : 4),
    [isPreview, routePolylineLatLngs],
  );
  const bounds = useMemo(
    () => computeLeafletBounds(routePolylinePoints),
    [routePolylinePoints],
  );

  const fitRouteBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !bounds) {
      return;
    }

    map.fitBounds(bounds, {
      padding: isPreview ? [16, 16] : [32, 32],
      maxZoom: isPreview ? 14 : 16,
    });
  }, [bounds, isPreview]);

  useEffect(() => {
    let cancelled = false;

    async function initMap(): Promise<void> {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      const leaflet = await import("leaflet");
      if (cancelled || !containerRef.current) {
        return;
      }

      leafletRef.current = leaflet;
      const tileConfig = getMapTileConfig();

      const map = leaflet.map(containerRef.current, {
        zoomControl: !isPreview,
        attributionControl: true,
        dragging: !isPreview,
        scrollWheelZoom: !isPreview,
        doubleClickZoom: !isPreview,
        boxZoom: !isPreview,
        keyboard: !isPreview,
        touchZoom: !isPreview,
      });

      leaflet
        .tileLayer(tileConfig.url, {
          attribution: tileConfig.attribution,
          maxZoom: 19,
        })
        .addTo(map);

      mapRef.current = map;
      setMapReady(true);
    }

    void initMap();

    return () => {
      cancelled = true;
      setMapReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      layersRef.current = {
        polyline: null,
        stops: null,
        buses: null,
        directions: null,
        busMarkersById: new Map(),
        stopMarkersById: new Map(),
      };
      leafletRef.current = null;
    };
  }, [isPreview]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!mapReady || !map || !container || isPreview) {
      return;
    }

    const updateStopLabelVisibility = (): void => {
      container.classList.toggle(
        "route-map-show-stop-labels",
        map.getZoom() >= 15,
      );
      container.classList.toggle(
        "route-map-show-vehicle-labels",
        map.getZoom() >= 14,
      );
    };

    map.on("zoomend", updateStopLabelVisibility);
    updateStopLabelVisibility();
    return () => {
      map.off("zoomend", updateStopLabelVisibility);
    };
  }, [isPreview, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!mapReady || !map || !leaflet || geographicStops.length < 2) {
      return;
    }

    layersRef.current.polyline?.remove();
    layersRef.current.stops?.clearLayers();
    layersRef.current.directions?.clearLayers();
    layersRef.current.stopMarkersById.clear();

    const routePolyline = leaflet
      .polyline(routePolylineLatLngs, {
        color: "#0284c7",
        weight: 4,
        opacity: 0.9,
      })
      .addTo(map);

    const stopsLayer = leaflet.layerGroup().addTo(map);
    for (const [index, stop] of geographicStops.entries()) {
      const isTerminal =
        index === 0 || index === geographicStops.length - 1;
      const icon = leaflet.divIcon({
        className: "route-map-leaflet-stop-icon",
        html: buildStopMarkerHtml(isTerminal),
        iconSize: [isTerminal ? 10 : 7, isTerminal ? 10 : 7],
        iconAnchor: [isTerminal ? 5 : 3.5, isTerminal ? 5 : 3.5],
      });

      const stopMarker = leaflet.marker([stop.lat, stop.lon], { icon });
      if (!isPreview) {
        stopMarker.bindPopup(
          buildStopPopupWithActionHtml(stop, route, direction),
          { className: "route-map-leaflet-popup route-map-stop-popup" },
        );
        stopMarker.bindTooltip(buildStopMapLabelHtml(stop), {
          className: isTerminal
            ? "route-map-stop-label route-map-terminal-label"
            : "route-map-stop-label",
          direction: "right",
          offset: [8, 0],
          permanent: true,
          interactive: true,
        });
      }
      stopMarker.addTo(stopsLayer);
      layersRef.current.stopMarkersById.set(stop.naptanId, stopMarker);
    }

    const directionsLayer = leaflet.layerGroup().addTo(map);
    for (const marker of directionMarkers) {
      const icon = leaflet.divIcon({
        className: "route-map-leaflet-direction-icon",
        html: buildDirectionArrowHtml(marker.bearing),
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      leaflet
        .marker([marker.point.lat, marker.point.lon], {
          icon,
          interactive: false,
        })
        .addTo(directionsLayer);
    }

    layersRef.current.polyline = routePolyline;
    layersRef.current.stops = stopsLayer;
    layersRef.current.directions = directionsLayer;

    fitRouteBounds();
  }, [direction, directionMarkers, fitRouteBounds, geographicStops, isPreview, mapReady, route, routePolylineLatLngs]);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!mapReady || !map || !leaflet) {
      return;
    }

    layersRef.current.buses?.clearLayers();
    layersRef.current.busMarkersById.clear();

    const busesLayer = layersRef.current.buses ?? leaflet.layerGroup().addTo(map);
    layersRef.current.buses = busesLayer;

    for (const { vehicle, point } of vehicleMarkers) {
      const colors = getLeafletMarkerColors(vehicle);
      const opacity = getLeafletMarkerOpacity(vehicle);
      const iconText = isPossibleGhostBus(vehicle)
        ? getGhostMarkerIconText(vehicle)
        : vehicle.routeNumber;

      const icon = leaflet.divIcon({
        className: "route-map-leaflet-bus-icon",
        html: buildBusMarkerHtml(
          iconText,
          colors,
          opacity,
          getMapVehicleBadge(vehicle),
        ),
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = leaflet.marker([point.lat, point.lon], { icon });

      if (!isPreview) {
        marker.bindPopup(
          buildBusPopupWithActionHtml(vehicle, loopLabelSettings),
          { className: "route-map-leaflet-popup route-map-bus-popup" },
        );
        marker.bindTooltip(
          buildVehicleMapLabelHtml(vehicle, loopLabelSettings),
          {
            className: "route-map-vehicle-label",
            direction: "left",
            offset: [-18, 0],
            permanent: true,
            interactive: true,
          },
        );
      }

      marker.addTo(busesLayer);
      layersRef.current.busMarkersById.set(vehicle.vehicleId, marker);
    }
  }, [isPreview, loopLabelSettings, mapReady, onVehicleSelect, vehicleMarkers]);

  useEffect(() => {
    fitRouteBounds();
  }, [fitBoundsSignal, fitRouteBounds]);

  useEffect(() => {
    if (isPreview || !selectedVehicleId) {
      return;
    }

    const marker = layersRef.current.busMarkersById.get(selectedVehicleId);
    if (!marker) {
      return;
    }

    marker.openPopup();
    mapRef.current?.panTo(marker.getLatLng(), { animate: true });
  }, [isPreview, selectedVehicleId, vehicleMarkers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || (!onStopSelect && !onVehicleSelect)) {
      return;
    }

    const handleClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const stopButton = target.closest('[data-stop-action="view-arrivals"]');
      if (stopButton instanceof HTMLElement && onStopSelect) {
        const stop = geographicStops.find(
          (entry) => entry.naptanId === stopButton.dataset.stopNaptan,
        );
        if (stop) {
          onStopSelect(stop);
        }
        return;
      }

      const stopLabelButton = target.closest("[data-stop-popup-id]");
      if (stopLabelButton instanceof HTMLElement) {
        const marker = layersRef.current.stopMarkersById.get(
          stopLabelButton.dataset.stopPopupId ?? "",
        );
        marker?.openPopup();
        return;
      }

      const vehicleLabelButton = target.closest("[data-vehicle-popup-id]");
      if (vehicleLabelButton instanceof HTMLElement) {
        const marker = layersRef.current.busMarkersById.get(
          vehicleLabelButton.dataset.vehiclePopupId ?? "",
        );
        marker?.openPopup();
        return;
      }

      const vehicleButton = target.closest(
        '[data-vehicle-action="full-info"]',
      );
      if (vehicleButton instanceof HTMLElement) {
        const marker = vehicleMarkers.find(
          (entry) =>
            entry.vehicle.vehicleId === vehicleButton.dataset.vehicleId,
        );
        if (marker) {
          onVehicleSelect(marker.vehicle);
        }
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [geographicStops, onStopSelect, onVehicleSelect, vehicleMarkers]);

  if (geographicStops.length < 2) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
        Map unavailable for this route right now
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`route-map-leaflet-container z-0 h-full w-full rounded-xl ${isPreview ? "min-h-[180px]" : "min-h-[240px]"} ${className ?? ""}`}
      role="region"
      aria-label={ariaLabel}
    />
  );
});

export default RouteLeafletMap;
