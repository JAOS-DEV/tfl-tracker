import type { DisplaySettings } from "@/lib/displaySettings";

export interface PublicFeatures {
  advancedDiagnostics: boolean;
  afterMidnightReplay: boolean;
}

function resolveFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}

export function resolvePublicFeatures(
  nodeEnv: string | undefined,
  advancedDiagnostics: string | undefined,
  afterMidnightReplay: string | undefined,
): PublicFeatures {
  const developmentDefault = nodeEnv !== "production";
  return {
    advancedDiagnostics: resolveFlag(
      advancedDiagnostics,
      developmentDefault,
    ),
    afterMidnightReplay: resolveFlag(
      afterMidnightReplay,
      developmentDefault,
    ),
  };
}

export const PUBLIC_FEATURES = resolvePublicFeatures(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_ENABLE_ADVANCED_DIAGNOSTICS,
  process.env.NEXT_PUBLIC_ENABLE_AFTER_MIDNIGHT_REPLAY,
);

export function applyAdvancedDiagnosticsAvailability(
  settings: DisplaySettings,
  available: boolean,
): DisplaySettings {
  return available || !settings.showAdvancedDiagnostics
    ? settings
    : { ...settings, showAdvancedDiagnostics: false };
}
