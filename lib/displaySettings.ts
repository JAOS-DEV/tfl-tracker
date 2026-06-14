import {
  createDefaultAlertPreferences,
  type RouteAlertPreferences,
} from "@/lib/routeAlerts";
import { STORAGE_KEYS } from "@/lib/storage";

export type DefaultVisualMode = "loop" | "list";

/** @deprecated Migrated to direct toggles; read only during normalization. */
type LegacyDisplayMode = "simple" | "advanced";

export interface GlobalAlertDefaults {
  warnBunching: boolean;
  warnNoLiveBuses: boolean;
  warnStaleData: boolean;
  warnPossibleGhost: boolean;
  warnPredictionDisappeared: boolean;
  warnEstimatedLateBus: boolean;
  estimatedLateMinutes: number;
}

export interface DisplaySettings {
  defaultVisualMode: DefaultVisualMode;
  showServiceDetailsInline: boolean;
  showHistoryInline: boolean;
  showAdvancedDiagnostics: boolean;
  smoothBusMovement: boolean;
  showScheduleGhosts: boolean;
  showBusRegistrationOnLoop: boolean;
  showBusFleetNumberOnLoop: boolean;
  showBusRunningNumberOnLoop: boolean;
  globalAlertDefaults: GlobalAlertDefaults;
}

const DEFAULT_ROUTE_ALERTS = createDefaultAlertPreferences("__defaults__");

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  defaultVisualMode: "loop",
  showServiceDetailsInline: false,
  showHistoryInline: false,
  showAdvancedDiagnostics: false,
  smoothBusMovement: true,
  showScheduleGhosts: true,
  showBusRegistrationOnLoop: false,
  showBusFleetNumberOnLoop: false,
  showBusRunningNumberOnLoop: false,
  globalAlertDefaults: {
    warnBunching: DEFAULT_ROUTE_ALERTS.warnBunching,
    warnNoLiveBuses: DEFAULT_ROUTE_ALERTS.warnNoLiveBuses,
    warnStaleData: DEFAULT_ROUTE_ALERTS.warnStaleData,
    warnPossibleGhost: DEFAULT_ROUTE_ALERTS.warnPossibleGhost,
    warnPredictionDisappeared: DEFAULT_ROUTE_ALERTS.warnPredictionDisappeared,
    warnEstimatedLateBus: DEFAULT_ROUTE_ALERTS.warnEstimatedLateBus,
    estimatedLateMinutes: DEFAULT_ROUTE_ALERTS.estimatedLateMinutes,
  },
};

export const DISPLAY_SETTINGS_STORAGE_KEY = STORAGE_KEYS.displaySettings;

interface LegacyDisplaySettings extends Partial<DisplaySettings> {
  displayMode?: LegacyDisplayMode;
  showHistoryInlineInAdvanced?: boolean;
}

function isDefaultVisualMode(value: unknown): value is DefaultVisualMode {
  return value === "loop" || value === "list";
}

function normalizeGlobalAlertDefaults(value: unknown): GlobalAlertDefaults {
  const defaults = DEFAULT_DISPLAY_SETTINGS.globalAlertDefaults;
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const raw = value as Partial<GlobalAlertDefaults>;
  return {
    warnBunching:
      typeof raw.warnBunching === "boolean"
        ? raw.warnBunching
        : defaults.warnBunching,
    warnNoLiveBuses:
      typeof raw.warnNoLiveBuses === "boolean"
        ? raw.warnNoLiveBuses
        : defaults.warnNoLiveBuses,
    warnStaleData:
      typeof raw.warnStaleData === "boolean"
        ? raw.warnStaleData
        : defaults.warnStaleData,
    warnPossibleGhost:
      typeof raw.warnPossibleGhost === "boolean"
        ? raw.warnPossibleGhost
        : defaults.warnPossibleGhost,
    warnPredictionDisappeared:
      typeof raw.warnPredictionDisappeared === "boolean"
        ? raw.warnPredictionDisappeared
        : defaults.warnPredictionDisappeared,
    warnEstimatedLateBus:
      typeof raw.warnEstimatedLateBus === "boolean"
        ? raw.warnEstimatedLateBus
        : defaults.warnEstimatedLateBus,
    estimatedLateMinutes:
      typeof raw.estimatedLateMinutes === "number" &&
      raw.estimatedLateMinutes > 0
        ? raw.estimatedLateMinutes
        : defaults.estimatedLateMinutes,
  };
}

function migrateInlineToggles(raw: LegacyDisplaySettings): {
  showServiceDetailsInline: boolean;
  showHistoryInline: boolean;
  showAdvancedDiagnostics: boolean;
} {
  const hasNewToggles =
    typeof raw.showServiceDetailsInline === "boolean" ||
    typeof raw.showHistoryInline === "boolean" ||
    typeof raw.showAdvancedDiagnostics === "boolean";

  if (hasNewToggles) {
    return {
      showServiceDetailsInline:
        typeof raw.showServiceDetailsInline === "boolean"
          ? raw.showServiceDetailsInline
          : DEFAULT_DISPLAY_SETTINGS.showServiceDetailsInline,
      showHistoryInline:
        typeof raw.showHistoryInline === "boolean"
          ? raw.showHistoryInline
          : DEFAULT_DISPLAY_SETTINGS.showHistoryInline,
      showAdvancedDiagnostics:
        typeof raw.showAdvancedDiagnostics === "boolean"
          ? raw.showAdvancedDiagnostics
          : DEFAULT_DISPLAY_SETTINGS.showAdvancedDiagnostics,
    };
  }

  if (raw.displayMode === "advanced") {
    return {
      showServiceDetailsInline: true,
      showHistoryInline:
        typeof raw.showHistoryInlineInAdvanced === "boolean"
          ? raw.showHistoryInlineInAdvanced
          : true,
      showAdvancedDiagnostics: true,
    };
  }

  return {
    showServiceDetailsInline: false,
    showHistoryInline: false,
    showAdvancedDiagnostics: false,
  };
}

export function normalizeDisplaySettings(value: unknown): DisplaySettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_DISPLAY_SETTINGS;
  }

  const raw = value as LegacyDisplaySettings;
  const inlineToggles = migrateInlineToggles(raw);

  return {
    defaultVisualMode: isDefaultVisualMode(raw.defaultVisualMode)
      ? raw.defaultVisualMode
      : DEFAULT_DISPLAY_SETTINGS.defaultVisualMode,
    showServiceDetailsInline: inlineToggles.showServiceDetailsInline,
    showHistoryInline: inlineToggles.showHistoryInline,
    showAdvancedDiagnostics: inlineToggles.showAdvancedDiagnostics,
    smoothBusMovement:
      typeof raw.smoothBusMovement === "boolean"
        ? raw.smoothBusMovement
        : DEFAULT_DISPLAY_SETTINGS.smoothBusMovement,
    showScheduleGhosts:
      typeof raw.showScheduleGhosts === "boolean"
        ? raw.showScheduleGhosts
        : DEFAULT_DISPLAY_SETTINGS.showScheduleGhosts,
    showBusRegistrationOnLoop:
      typeof raw.showBusRegistrationOnLoop === "boolean"
        ? raw.showBusRegistrationOnLoop
        : DEFAULT_DISPLAY_SETTINGS.showBusRegistrationOnLoop,
    showBusFleetNumberOnLoop:
      typeof raw.showBusFleetNumberOnLoop === "boolean"
        ? raw.showBusFleetNumberOnLoop
        : DEFAULT_DISPLAY_SETTINGS.showBusFleetNumberOnLoop,
    showBusRunningNumberOnLoop:
      typeof raw.showBusRunningNumberOnLoop === "boolean"
        ? raw.showBusRunningNumberOnLoop
        : DEFAULT_DISPLAY_SETTINGS.showBusRunningNumberOnLoop,
    globalAlertDefaults: normalizeGlobalAlertDefaults(raw.globalAlertDefaults),
  };
}

export function createRouteAlertPreferences(
  routeId: string,
  globalDefaults: GlobalAlertDefaults,
  routeOverrides?: Partial<RouteAlertPreferences>,
): RouteAlertPreferences {
  return {
    ...globalDefaults,
    ...routeOverrides,
    routeId,
  };
}
