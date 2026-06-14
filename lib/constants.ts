export const SERVICE_INTELLIGENCE_THRESHOLDS = {
  BUNCHING_THRESHOLD_MINUTES: 2,
  STALE_DATA_THRESHOLD_SECONDS: 90,
  PREDICTION_DISAPPEARED_REFRESH_COUNT: 2,
  NEARBY_STOP_INDEX_THRESHOLD: 3,
  MIN_LIVE_VEHICLES_HEALTHY: 3,
} as const;

export const GHOST_BUS_THRESHOLDS = {
  MISSING_REFRESH_THRESHOLD: 1,
  DISAPPEARED_REFRESH_THRESHOLD: 2,
  SUSPECTED_GHOST_REFRESH_THRESHOLD: 3,
  DUE_SOON_GHOST_THRESHOLD_MINUTES: 2,
  GHOST_GRACE_PERIOD_SECONDS: 90,
  REAPPEARED_DISPLAY_SECONDS: 60,
} as const;

export const SCHEDULE_DEVIATION_THRESHOLDS = {
  EARLY_MINUTES: -2,
  ON_TIME_MAX_MINUTES: 1,
  LATE_MINUTES: 2,
  MATCH_WINDOW_MINUTES: 90,
  HIGH_CONFIDENCE_MINUTES: 3,
  MEDIUM_CONFIDENCE_MINUTES: 8,
} as const;

export const TIMETABLE_CACHE_TTL_MS = 30 * 60 * 1000;

export const STOP_DISRUPTIONS_BATCH_SIZE = 100;

export const HEADWAY_THRESHOLDS = {
  BUNCHING_MINUTES: SERVICE_INTELLIGENCE_THRESHOLDS.BUNCHING_THRESHOLD_MINUTES,
} as const;

export type LoopOrientation = "landscape" | "portrait";

export interface LoopLayoutConfig {
  viewBoxWidth: number;
  viewBoxHeight: number;
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
  orientation: LoopOrientation;
}

export const LOOP_EDGE_PADDING = 0.012;

export const LOOP_LAYOUT: LoopLayoutConfig = {
  viewBoxWidth: 1000,
  viewBoxHeight: 520,
  leftX: 100,
  rightX: 900,
  topY: 130,
  bottomY: 390,
  orientation: "landscape",
};

export const LOOP_MOBILE_MIN_STOP_SPACING = 62;

export const LOOP_LAYOUT_MOBILE_BASE = {
  viewBoxWidth: 520,
  leftX: 178,
  rightX: 342,
  topY: 72,
  orientation: "portrait" as const,
};

export function getLoopLayout(
  isMobile: boolean,
  route?: { outbound: unknown[]; inbound: unknown[] },
): LoopLayoutConfig {
  if (!isMobile) {
    return LOOP_LAYOUT;
  }

  const maxStops = Math.max(
    route?.outbound.length ?? 0,
    route?.inbound.length ?? 0,
  );
  const legHeight =
    Math.max(maxStops - 1, 1) * LOOP_MOBILE_MIN_STOP_SPACING;
  const bottomY = LOOP_LAYOUT_MOBILE_BASE.topY + legHeight;

  return {
    viewBoxWidth: LOOP_LAYOUT_MOBILE_BASE.viewBoxWidth,
    viewBoxHeight: bottomY + 56,
    leftX: LOOP_LAYOUT_MOBILE_BASE.leftX,
    rightX: LOOP_LAYOUT_MOBILE_BASE.rightX,
    topY: LOOP_LAYOUT_MOBILE_BASE.topY,
    bottomY,
    orientation: "portrait",
  };
}

export const VEHICLE_POSITIONING = {
  maxOffsetProgress: 0.04,
  nearStopSeconds: 60,
} as const;

export const SCHEDULE_ADHERENCE_THRESHOLDS = {
  lateSeconds: 120,
  earlySeconds: 120,
  secondsPerStopEstimate: 90,
} as const;
