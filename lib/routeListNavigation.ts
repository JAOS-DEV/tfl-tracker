import {
  buildStopRowDomId,
  buildStopRowKey,
} from "@/lib/listRowKeys";
import type {
  EstimatedVehiclePosition,
  NormalizedStop,
  RouteDirection,
} from "@/lib/tfl/types";

export const LIST_JUMP_SCROLL_PADDING = 8;

export interface BusJumpCandidate {
  rowKey: string;
  domId: string;
  stopIndex: number;
  direction: RouteDirection;
  vehicles: EstimatedVehiclePosition[];
}

export function isLiveBusAtStop(
  vehicle: EstimatedVehiclePosition,
  stop: NormalizedStop,
  direction: RouteDirection,
): boolean {
  return (
    !vehicle.isScheduledGhostCandidate &&
    vehicle.matched &&
    vehicle.direction === direction &&
    vehicle.nextStop?.naptanId === stop.naptanId
  );
}

export function findNextLiveVehicle(
  vehicles: EstimatedVehiclePosition[],
  direction: RouteDirection,
): EstimatedVehiclePosition | null {
  const live = vehicles
    .filter(
      (vehicle) =>
        !vehicle.isScheduledGhostCandidate &&
        vehicle.matched &&
        vehicle.direction === direction &&
        vehicle.nextStop,
    )
    .sort((left, right) => left.progress - right.progress);

  return live[0] ?? null;
}

export function findStopIndexInDirection(
  stops: NormalizedStop[],
  naptanId: string,
  preferredIndex?: number,
): number {
  const matchingIndices = stops
    .map((stop, index) => (stop.naptanId === naptanId ? index : -1))
    .filter((index) => index >= 0);

  if (matchingIndices.length === 0) {
    return -1;
  }

  if (
    preferredIndex !== undefined &&
    matchingIndices.includes(preferredIndex)
  ) {
    return preferredIndex;
  }

  return matchingIndices[0] ?? -1;
}

export function resolveJumpTargetStopIndex(
  vehicle: EstimatedVehiclePosition,
  stops: NormalizedStop[],
): number {
  if (!vehicle.nextStop) {
    return -1;
  }

  const preferredIndex =
    vehicle.stopIndex >= 0 &&
    vehicle.stopIndex < stops.length &&
    stops[vehicle.stopIndex]?.naptanId === vehicle.nextStop.naptanId
      ? vehicle.stopIndex
      : undefined;

  return findStopIndexInDirection(
    stops,
    vehicle.nextStop.naptanId,
    preferredIndex,
  );
}

export function buildLiveBusJumpCandidates(
  routeId: string,
  direction: RouteDirection,
  stops: NormalizedStop[],
  vehicles: EstimatedVehiclePosition[],
): BusJumpCandidate[] {
  const candidates: BusJumpCandidate[] = [];

  for (let stopIndex = 0; stopIndex < stops.length; stopIndex += 1) {
    const stop = stops[stopIndex];
    if (!stop) {
      continue;
    }

    const liveVehicles = vehicles.filter((vehicle) =>
      isLiveBusAtStop(vehicle, stop, direction),
    );

    if (liveVehicles.length === 0) {
      continue;
    }

    const rowKey = buildStopRowKey(routeId, direction, stop.id, stopIndex);
    candidates.push({
      rowKey,
      domId: buildStopRowDomId(rowKey),
      stopIndex,
      direction,
      vehicles: liveVehicles,
    });
  }

  return candidates;
}

export function pickNextJumpCandidate(
  candidates: BusJumpCandidate[],
  lastJumpedRowKey: string | null,
): BusJumpCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  if (!lastJumpedRowKey) {
    return candidates[0] ?? null;
  }

  const currentIndex = candidates.findIndex(
    (candidate) => candidate.rowKey === lastJumpedRowKey,
  );

  if (currentIndex < 0) {
    return candidates[0] ?? null;
  }

  const nextIndex = (currentIndex + 1) % candidates.length;
  return candidates[nextIndex] ?? null;
}

export function pickInitialJumpCandidate(
  candidates: BusJumpCandidate[],
  container: HTMLElement | null,
  scrollPadding = LIST_JUMP_SCROLL_PADDING,
): BusJumpCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  if (!container) {
    return candidates[0] ?? null;
  }

  const scrollTop = container.scrollTop;

  for (const candidate of candidates) {
    const element = findRowElement(container, candidate.domId);
    if (!element) {
      continue;
    }

    const rowBottom = element.offsetTop + element.offsetHeight;
    if (rowBottom > scrollTop + scrollPadding) {
      return candidate;
    }
  }

  return candidates[0] ?? null;
}

export function pickJumpCandidateOnClick(
  candidates: BusJumpCandidate[],
  lastJumpedRowKey: string | null,
  container: HTMLElement | null,
): BusJumpCandidate | null {
  if (lastJumpedRowKey === null) {
    return pickInitialJumpCandidate(candidates, container);
  }

  return pickNextJumpCandidate(candidates, lastJumpedRowKey);
}

export function getJumpButtonLabel(
  candidates: BusJumpCandidate[],
  lastJumpedRowKey: string | null,
): string {
  if (candidates.length === 0) {
    return "";
  }

  if (candidates.length === 1) {
    return lastJumpedRowKey ? "Next bus" : "Jump to next bus";
  }

  if (!lastJumpedRowKey) {
    return "Jump to next bus";
  }

  const nextCandidate = pickNextJumpCandidate(candidates, lastJumpedRowKey);
  const nextIndex =
    candidates.findIndex(
      (candidate) => candidate.rowKey === nextCandidate?.rowKey,
    ) + 1;

  return `Next bus (${nextIndex}/${candidates.length})`;
}

function findRowElement(
  container: HTMLElement | null,
  domId: string,
): HTMLElement | null {
  if (container) {
    return container.querySelector(
      `#${CSS.escape(domId)}`,
    ) as HTMLElement | null;
  }

  return document.getElementById(domId);
}

export function scrollStopRowIntoListContainer(
  container: HTMLElement | null,
  domId: string,
  scrollPadding = LIST_JUMP_SCROLL_PADDING,
): boolean {
  const target = findRowElement(container, domId);

  if (!target) {
    return false;
  }

  if (container) {
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset =
      targetRect.top -
      containerRect.top +
      container.scrollTop -
      scrollPadding;

    container.scrollTo({
      top: Math.max(0, offset),
      behavior: "smooth",
    });
    return true;
  }

  target.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}
