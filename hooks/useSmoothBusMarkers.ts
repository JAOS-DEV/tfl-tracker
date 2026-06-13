"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildDisplayReference,
  buildMarkerSnapshot,
  decideMarkerMovement,
  getDefaultSmoothTransitionDurationMs,
  interpolateMarkerPosition,
  interpolateMarkerProgress,
  logMovementDecision,
  type DisplayReference,
  type MarkerSnapshot,
  type SmoothBusMovementOptions,
  type SmoothMovementDecision,
} from "@/lib/smoothBusMovement";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

export interface DisplayMarkerPosition {
  x: number;
  y: number;
  progress: number;
}

export interface SmoothBusMarkersResult {
  displayPositions: Record<string, DisplayMarkerPosition>;
  movementDecisions: Record<string, SmoothMovementDecision>;
}

interface ActiveMarkerAnimation {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromProgress: number;
  toProgress: number;
  startTime: number;
  durationMs: number;
}

const routeSnapshots = new Map<string, Map<string, MarkerSnapshot>>();

export function resetSmoothBusMarkerStore(routeId?: string): void {
  if (routeId) {
    routeSnapshots.delete(routeId);
    return;
  }
  routeSnapshots.clear();
}

function getRouteSnapshots(routeId: string): Map<string, MarkerSnapshot> {
  const existing = routeSnapshots.get(routeId);
  if (existing) {
    return existing;
  }
  const created = new Map<string, MarkerSnapshot>();
  routeSnapshots.set(routeId, created);
  return created;
}

function buildDisplayPositions(
  vehicles: EstimatedVehiclePosition[],
  displays: Map<string, DisplayMarkerPosition>,
): Record<string, DisplayMarkerPosition> {
  const nextDisplay: Record<string, DisplayMarkerPosition> = {};
  for (const vehicle of vehicles) {
    const display = displays.get(vehicle.vehicleId);
    nextDisplay[vehicle.vehicleId] = display ?? {
      x: vehicle.x,
      y: vehicle.y,
      progress: vehicle.progress,
    };
  }
  return nextDisplay;
}

function toDisplayReference(
  display: DisplayMarkerPosition | undefined,
): DisplayReference | null {
  if (!display) {
    return null;
  }
  return {
    x: display.x,
    y: display.y,
    progress: display.progress,
  };
}

export function useSmoothBusMarkers(
  routeId: string,
  vehicles: EstimatedVehiclePosition[],
  options: SmoothBusMovementOptions,
): SmoothBusMarkersResult {
  const [displayPositions, setDisplayPositions] = useState<
    Record<string, DisplayMarkerPosition>
  >({});
  const [movementDecisions, setMovementDecisions] = useState<
    Record<string, SmoothMovementDecision>
  >({});
  const displayPositionsRef = useRef<Map<string, DisplayMarkerPosition>>(
    new Map(),
  );
  const animationsRef = useRef<Map<string, ActiveMarkerAnimation>>(new Map());
  const frameRef = useRef<number | null>(null);
  const vehiclesRef = useRef(vehicles);

  useEffect(() => {
    vehiclesRef.current = vehicles;
  }, [vehicles]);

  useEffect(() => {
    const activeAnimations = animationsRef.current;
    return () => {
      const activeFrame = frameRef.current;
      if (activeFrame !== null) {
        cancelAnimationFrame(activeFrame);
      }
      activeAnimations.clear();
    };
  }, [routeId]);

  useEffect(() => {
    const snapshots = getRouteSnapshots(routeId);
    const displays = displayPositionsRef.current;
    const animations = animationsRef.current;
    const transitionDurationMs =
      options.transitionDurationMs ?? getDefaultSmoothTransitionDurationMs();
    const activeVehicleIds = new Set<string>();
    const nextDecisions: Record<string, SmoothMovementDecision> = {};
    const now = performance.now();

    for (const vehicle of vehicles) {
      activeVehicleIds.add(vehicle.vehicleId);
      const previous = snapshots.get(vehicle.vehicleId) ?? null;
      const currentDisplay = displays.get(vehicle.vehicleId);
      const displayReference = buildDisplayReference(
        previous,
        toDisplayReference(currentDisplay),
      );
      const decision = decideMarkerMovement(
        vehicle,
        previous,
        routeId,
        displayReference,
        {
          smoothBusMovementEnabled: options.smoothBusMovementEnabled,
          prefersReducedMotion: options.prefersReducedMotion,
          transitionDurationMs,
          maxJumpDistance: options.maxJumpDistance,
        },
      );
      nextDecisions[vehicle.vehicleId] = decision;
      logMovementDecision(routeId, vehicle.vehicleId, decision);

      if (decision.mode === "hold") {
        animations.delete(vehicle.vehicleId);
        const held = currentDisplay ??
          displayReference ?? {
            x: vehicle.x,
            y: vehicle.y,
            progress: vehicle.progress,
          };
        displays.set(vehicle.vehicleId, held);
        if (previous) {
          snapshots.set(vehicle.vehicleId, {
            ...previous,
            progress: held.progress,
            x: held.x,
            y: held.y,
          });
        } else {
          snapshots.set(
            vehicle.vehicleId,
            buildMarkerSnapshot(vehicle, routeId, {
              progress: held.progress,
              x: held.x,
              y: held.y,
            }),
          );
        }
        continue;
      }

      if (decision.mode === "snap") {
        animations.delete(vehicle.vehicleId);
        displays.set(vehicle.vehicleId, {
          x: vehicle.x,
          y: vehicle.y,
          progress: vehicle.progress,
        });
        snapshots.set(vehicle.vehicleId, buildMarkerSnapshot(vehicle, routeId));
        continue;
      }

      const fromX = currentDisplay?.x ?? previous?.x ?? vehicle.x;
      const fromY = currentDisplay?.y ?? previous?.y ?? vehicle.y;
      const fromProgress =
        currentDisplay?.progress ?? previous?.progress ?? vehicle.progress;

      animations.set(vehicle.vehicleId, {
        fromX,
        fromY,
        toX: vehicle.x,
        toY: vehicle.y,
        fromProgress,
        toProgress: vehicle.progress,
        startTime: now,
        durationMs: transitionDurationMs,
      });
    }

    for (const vehicleId of [...snapshots.keys()]) {
      if (!activeVehicleIds.has(vehicleId)) {
        snapshots.delete(vehicleId);
        displays.delete(vehicleId);
        animations.delete(vehicleId);
      }
    }

    const publishDisplay = () => {
      setDisplayPositions(buildDisplayPositions(vehicles, displays));
      setMovementDecisions(nextDecisions);
    };

    const snapAnimationsToTargets = () => {
      const currentVehicles = vehiclesRef.current;
      for (const [vehicleId, animation] of animationsRef.current) {
        displays.set(vehicleId, {
          x: animation.toX,
          y: animation.toY,
          progress: animation.toProgress,
        });
        const vehicle = currentVehicles.find(
          (entry) => entry.vehicleId === vehicleId,
        );
        if (vehicle) {
          snapshots.set(vehicleId, buildMarkerSnapshot(vehicle, routeId));
        }
      }
      animationsRef.current.clear();
    };

    const runFrame = () => {
      if (document.hidden) {
        snapAnimationsToTargets();
        frameRef.current = null;
        publishDisplay();
        return;
      }

      const currentAnimations = animationsRef.current;
      const currentVehicles = vehiclesRef.current;
      const frameNow = performance.now();
      let anyActive = false;

      for (const [vehicleId, animation] of currentAnimations) {
        const elapsed = frameNow - animation.startTime;
        const progress = Math.min(1, elapsed / animation.durationMs);
        const position = interpolateMarkerPosition(
          animation.fromX,
          animation.fromY,
          animation.toX,
          animation.toY,
          progress,
        );
        const routeProgress = interpolateMarkerProgress(
          animation.fromProgress,
          animation.toProgress,
          progress,
        );
        displays.set(vehicleId, {
          x: position.x,
          y: position.y,
          progress: routeProgress,
        });

        if (progress >= 1) {
          currentAnimations.delete(vehicleId);
          const vehicle = currentVehicles.find(
            (entry) => entry.vehicleId === vehicleId,
          );
          if (vehicle) {
            snapshots.set(vehicleId, buildMarkerSnapshot(vehicle, routeId));
          }
        } else {
          anyActive = true;
        }
      }

      publishDisplay();

      if (anyActive) {
        frameRef.current = requestAnimationFrame(runFrame);
      } else {
        frameRef.current = null;
      }
    };

    if (animations.size > 0) {
      const activeFrame = frameRef.current;
      if (activeFrame !== null) {
        cancelAnimationFrame(activeFrame);
      }
      frameRef.current = requestAnimationFrame(runFrame);
    } else {
      const publishFrame = requestAnimationFrame(publishDisplay);
      return () => {
        cancelAnimationFrame(publishFrame);
      };
    }

    return () => {
      const activeFrame = frameRef.current;
      if (activeFrame !== null) {
        cancelAnimationFrame(activeFrame);
        frameRef.current = null;
      }
    };
  }, [
    routeId,
    vehicles,
    options.smoothBusMovementEnabled,
    options.prefersReducedMotion,
    options.transitionDurationMs,
    options.maxJumpDistance,
  ]);

  return { displayPositions, movementDecisions };
}
