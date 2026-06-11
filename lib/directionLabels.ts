import type { NormalizedRoute, RouteDirection, RouteVisualMode } from "@/lib/tfl/types";

export type DirectionLabelVariant = "mobile" | "desktop";

function getTerminusName(
  route: NormalizedRoute,
  direction: RouteDirection,
): string {
  const stops = direction === "outbound" ? route.outbound : route.inbound;
  if (stops.length === 0) {
    return direction === "outbound" ? "Outbound" : "Inbound";
  }
  return stops[stops.length - 1]?.name ?? route.routeName;
}

export function getShortDirectionLabel(
  route: NormalizedRoute,
  direction: RouteDirection,
  variant: DirectionLabelVariant,
): string {
  const terminus = getTerminusName(route, direction);
  if (variant === "mobile") {
    return `To ${terminus}`;
  }
  return `Towards ${terminus}`;
}

export interface LoopHeaderTermini {
  outboundTerminus: string;
  inboundTerminus: string;
  isSame: boolean;
}

export function getLoopHeaderTermini(route: NormalizedRoute): LoopHeaderTermini {
  const outboundTerminus = getTerminusName(route, "outbound");
  const inboundTerminus = getTerminusName(route, "inbound");

  return {
    outboundTerminus,
    inboundTerminus,
    isSame: outboundTerminus === inboundTerminus,
  };
}

export function getLoopHeaderDestinationLabel(
  route: NormalizedRoute,
  variant: DirectionLabelVariant,
): string {
  const { outboundTerminus, inboundTerminus, isSame } =
    getLoopHeaderTermini(route);

  if (isSame) {
    return outboundTerminus;
  }

  const loopLabel = `${outboundTerminus} ↔ ${inboundTerminus}`;
  if (variant === "mobile") {
    return loopLabel;
  }
  return `Route loop · ${loopLabel}`;
}

export function getHeaderDestinationLabel(
  route: NormalizedRoute,
  direction: RouteDirection,
  variant: DirectionLabelVariant,
): string {
  return getShortDirectionLabel(route, direction, variant);
}

export function getRouteCardHeaderLabel(
  route: NormalizedRoute,
  options: {
    visualMode: RouteVisualMode;
    selectedDirection: RouteDirection;
    variant: DirectionLabelVariant;
  },
): string {
  if (options.visualMode === "loop") {
    return getLoopHeaderDestinationLabel(route, options.variant);
  }
  return getShortDirectionLabel(
    route,
    options.selectedDirection,
    options.variant,
  );
}
