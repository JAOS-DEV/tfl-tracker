import { POLL_INTERVAL_MS } from "@/lib/storage";
import type {
  EstimatedVehiclePosition,
  PredictionConfidence,
  RouteDirection,
} from "@/lib/tfl/types";

export const SMOOTH_BUS_TRANSITION_MS = 22_000;
export const MAX_MARKER_JUMP_DISTANCE = 350;
export const BACKWARDS_JITTER_HOLD_TOLERANCE = 0.02;
export const MIN_FORWARD_PROGRESS_DELTA = 0.003;

export interface MarkerSnapshot {
  routeId: string;
  vehicleId: string;
  direction: RouteDirection;
  progress: number;
  x: number;
  y: number;
}

export interface DisplayReference {
  x: number;
  y: number;
  progress: number;
}

export interface SmoothBusMovementOptions {
  smoothBusMovementEnabled: boolean;
  prefersReducedMotion: boolean;
  transitionDurationMs?: number;
  maxJumpDistance?: number;
}

export type SmoothMovementAnimateReason = "safe-forward-movement";

export type SmoothMovementSnapReason =
  | "first-seen"
  | "missing-vehicle-id"
  | "ghost"
  | "stale"
  | "disappeared"
  | "reappeared"
  | "route-changed"
  | "direction-changed"
  | "invalid-position"
  | "wrap-boundary"
  | "jump-too-far"
  | "backwards-jump"
  | "reduced-motion"
  | "setting-disabled"
  | "unmatched-position";

export type SmoothMovementHoldReason =
  | "small-backwards-jitter"
  | "negligible-movement";

export type SmoothMovementDecision =
  | { mode: "animate"; reason: SmoothMovementAnimateReason }
  | { mode: "snap"; reason: SmoothMovementSnapReason }
  | { mode: "hold"; reason: SmoothMovementHoldReason };

export function getStableVehicleKey(
  routeId: string,
  vehicleId: string,
): string {
  return `${routeId}:${vehicleId}`;
}

export function isValidMarkerPosition(x: number, y: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    !(x === 0 && y === 0)
  );
}

export function crossesLoopWrapBoundary(
  previousProgress: number,
  nextProgress: number,
): boolean {
  const previousOutbound = previousProgress < 0.5;
  const nextOutbound = nextProgress < 0.5;
  return previousOutbound !== nextOutbound;
}

export function getReferenceProgress(
  previous: MarkerSnapshot,
  displayReference: DisplayReference | null | undefined,
): number {
  if (!displayReference) {
    return previous.progress;
  }
  return Math.max(previous.progress, displayReference.progress);
}

export function isSmallBackwardsJitter(
  referenceProgress: number,
  nextProgress: number,
): boolean {
  return (
    nextProgress < referenceProgress &&
    referenceProgress - nextProgress <= BACKWARDS_JITTER_HOLD_TOLERANCE
  );
}

export function isLargeBackwardsJump(
  referenceProgress: number,
  nextProgress: number,
): boolean {
  return (
    nextProgress < referenceProgress - BACKWARDS_JITTER_HOLD_TOLERANCE
  );
}

export function isForwardProgressChange(
  referenceProgress: number,
  nextProgress: number,
): boolean {
  return nextProgress >= referenceProgress + MIN_FORWARD_PROGRESS_DELTA;
}

export function markerJumpDistance(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  return Math.hypot(toX - fromX, toY - fromY);
}

function isStalePrediction(vehicle: EstimatedVehiclePosition): boolean {
  return (
    vehicle.predictionConfidence === "stale" ||
    vehicle.ghostStatus === "stale"
  );
}

function isDisappearedPrediction(vehicle: EstimatedVehiclePosition): boolean {
  return (
    vehicle.predictionConfidence === "disappeared" ||
    vehicle.predictionConfidence === "missing" ||
    vehicle.ghostStatus === "disappeared" ||
    vehicle.ghostStatus === "missingLatest"
  );
}

function isGhostPrediction(vehicle: EstimatedVehiclePosition): boolean {
  return (
    vehicle.isSuspectedGhost || vehicle.ghostStatus === "suspectedGhost"
  );
}

function isReappearedPrediction(vehicle: EstimatedVehiclePosition): boolean {
  return (
    vehicle.ghostStatus === "reappeared" ||
    vehicle.predictionConfidence === "reappeared"
  );
}

export function decideMarkerMovement(
  vehicle: EstimatedVehiclePosition,
  previous: MarkerSnapshot | null,
  routeId: string,
  displayReference: DisplayReference | null | undefined,
  options: SmoothBusMovementOptions,
): SmoothMovementDecision {
  if (!options.smoothBusMovementEnabled) {
    return { mode: "snap", reason: "setting-disabled" };
  }

  if (options.prefersReducedMotion) {
    return { mode: "snap", reason: "reduced-motion" };
  }

  if (!vehicle.vehicleId.trim()) {
    return { mode: "snap", reason: "missing-vehicle-id" };
  }

  if (vehicle.isScheduledGhostCandidate) {
    return { mode: "snap", reason: "ghost" };
  }

  if (vehicle.markerState === "terminus-layover") {
    return { mode: "hold", reason: "negligible-movement" };
  }

  if (isGhostPrediction(vehicle)) {
    return { mode: "snap", reason: "ghost" };
  }

  if (isDisappearedPrediction(vehicle)) {
    return { mode: "snap", reason: "disappeared" };
  }

  if (isReappearedPrediction(vehicle)) {
    return { mode: "snap", reason: "reappeared" };
  }

  if (isStalePrediction(vehicle)) {
    return { mode: "snap", reason: "stale" };
  }

  if (!vehicle.matched) {
    return { mode: "snap", reason: "unmatched-position" };
  }

  if (!previous) {
    return { mode: "snap", reason: "first-seen" };
  }

  if (previous.routeId !== routeId) {
    return { mode: "snap", reason: "route-changed" };
  }

  if (previous.direction !== vehicle.direction) {
    return { mode: "snap", reason: "direction-changed" };
  }

  if (
    !isValidMarkerPosition(vehicle.x, vehicle.y) ||
    !isValidMarkerPosition(previous.x, previous.y)
  ) {
    return { mode: "snap", reason: "invalid-position" };
  }

  const referenceProgress = getReferenceProgress(previous, displayReference);
  const referenceX = displayReference?.x ?? previous.x;
  const referenceY = displayReference?.y ?? previous.y;

  if (crossesLoopWrapBoundary(referenceProgress, vehicle.progress)) {
    return { mode: "snap", reason: "wrap-boundary" };
  }

  if (isSmallBackwardsJitter(referenceProgress, vehicle.progress)) {
    return { mode: "hold", reason: "small-backwards-jitter" };
  }

  if (isLargeBackwardsJump(referenceProgress, vehicle.progress)) {
    return { mode: "snap", reason: "backwards-jump" };
  }

  const maxJump = options.maxJumpDistance ?? MAX_MARKER_JUMP_DISTANCE;
  const distance = markerJumpDistance(
    referenceX,
    referenceY,
    vehicle.x,
    vehicle.y,
  );

  if (distance > maxJump) {
    return { mode: "snap", reason: "jump-too-far" };
  }

  if (!isForwardProgressChange(referenceProgress, vehicle.progress)) {
    return { mode: "hold", reason: "negligible-movement" };
  }

  return { mode: "animate", reason: "safe-forward-movement" };
}

/** @deprecated Use decideMarkerMovement instead. */
export function shouldAnimateMarkerMovement(
  vehicle: EstimatedVehiclePosition,
  previous: MarkerSnapshot | null,
  routeId: string,
  options: SmoothBusMovementOptions,
): { shouldAnimate: boolean; reason?: string } {
  const decision = decideMarkerMovement(
    vehicle,
    previous,
    routeId,
    null,
    options,
  );
  return {
    shouldAnimate: decision.mode === "animate",
    reason: decision.reason,
  };
}

export function buildMarkerSnapshot(
  vehicle: EstimatedVehiclePosition,
  routeId: string,
  overrides?: Partial<Pick<MarkerSnapshot, "progress" | "x" | "y">>,
): MarkerSnapshot {
  return {
    routeId,
    vehicleId: vehicle.vehicleId,
    direction: vehicle.direction,
    progress: overrides?.progress ?? vehicle.progress,
    x: overrides?.x ?? vehicle.x,
    y: overrides?.y ?? vehicle.y,
  };
}

export function buildDisplayReference(
  snapshot: MarkerSnapshot | null,
  display: DisplayReference | null | undefined,
): DisplayReference | null {
  if (!snapshot && !display) {
    return null;
  }
  if (!snapshot) {
    return display ?? null;
  }
  if (!display) {
    return {
      x: snapshot.x,
      y: snapshot.y,
      progress: snapshot.progress,
    };
  }
  return {
    x: display.x,
    y: display.y,
    progress: Math.max(snapshot.progress, display.progress),
  };
}

export function interpolateMarkerPosition(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  progress: number,
): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, progress));
  return {
    x: fromX + (toX - fromX) * clamped,
    y: fromY + (toY - fromY) * clamped,
  };
}

export function interpolateMarkerProgress(
  fromProgress: number,
  toProgress: number,
  progress: number,
): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return fromProgress + (toProgress - fromProgress) * clamped;
}

export function getDefaultSmoothTransitionDurationMs(): number {
  return Math.min(SMOOTH_BUS_TRANSITION_MS, POLL_INTERVAL_MS - 2_000);
}

export function isAnimationConfidence(
  confidence: PredictionConfidence | undefined,
): boolean {
  return confidence === "normal" || confidence === undefined;
}

export function formatMovementDecision(
  decision: SmoothMovementDecision,
): string {
  return `${decision.mode}: ${decision.reason}`;
}

export function logMovementDecision(
  routeId: string,
  vehicleId: string,
  decision: SmoothMovementDecision,
): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  console.debug(
    `[smooth-bus] route=${routeId} vehicle=${vehicleId} ${formatMovementDecision(decision)}`,
  );
}
