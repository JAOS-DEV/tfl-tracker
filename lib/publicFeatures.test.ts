import { describe, expect, it } from "vitest";
import {
  applyAdvancedDiagnosticsAvailability,
  resolvePublicFeatures,
} from "@/lib/publicFeatures";
import { DEFAULT_DISPLAY_SETTINGS } from "@/lib/displaySettings";

describe("public feature flags", () => {
  it("shows developer tools by default in development", () => {
    expect(resolvePublicFeatures("development", undefined, undefined)).toEqual({
      advancedDiagnostics: true,
      afterMidnightReplay: true,
    });
  });

  it("hides developer tools by default in production", () => {
    expect(resolvePublicFeatures("production", undefined, undefined)).toEqual({
      advancedDiagnostics: false,
      afterMidnightReplay: false,
    });
  });

  it("supports explicit build-time overrides", () => {
    expect(resolvePublicFeatures("production", "true", "true")).toEqual({
      advancedDiagnostics: true,
      afterMidnightReplay: true,
    });
    expect(resolvePublicFeatures("development", "false", "false")).toEqual({
      advancedDiagnostics: false,
      afterMidnightReplay: false,
    });
  });

  it("forces persisted advanced diagnostics off when unavailable", () => {
    expect(
      applyAdvancedDiagnosticsAvailability(
        { ...DEFAULT_DISPLAY_SETTINGS, showAdvancedDiagnostics: true },
        false,
      ).showAdvancedDiagnostics,
    ).toBe(false);
  });
});
