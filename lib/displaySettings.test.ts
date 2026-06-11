import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISPLAY_SETTINGS,
  createRouteAlertPreferences,
  normalizeDisplaySettings,
} from "@/lib/displaySettings";

describe("displaySettings", () => {
  it("uses direct display toggles by default", () => {
    expect(DEFAULT_DISPLAY_SETTINGS.defaultVisualMode).toBe("loop");
    expect(DEFAULT_DISPLAY_SETTINGS.compactRouteCards).toBe(true);
    expect(DEFAULT_DISPLAY_SETTINGS.showServiceDetailsInline).toBe(false);
    expect(DEFAULT_DISPLAY_SETTINGS.showHistoryInline).toBe(false);
    expect(DEFAULT_DISPLAY_SETTINGS.showAdvancedDiagnostics).toBe(false);
  });

  it("normalizes unknown values to defaults", () => {
    const settings = normalizeDisplaySettings({
      defaultVisualMode: "map",
      compactRouteCards: "yes",
    });

    expect(settings.defaultVisualMode).toBe("loop");
    expect(settings.compactRouteCards).toBe(true);
    expect(settings.showServiceDetailsInline).toBe(false);
  });

  it("preserves direct toggles when stored", () => {
    const settings = normalizeDisplaySettings({
      defaultVisualMode: "list",
      compactRouteCards: false,
      showServiceDetailsInline: true,
      showHistoryInline: true,
      showAdvancedDiagnostics: true,
    });

    expect(settings.defaultVisualMode).toBe("list");
    expect(settings.compactRouteCards).toBe(false);
    expect(settings.showServiceDetailsInline).toBe(true);
    expect(settings.showHistoryInline).toBe(true);
    expect(settings.showAdvancedDiagnostics).toBe(true);
  });

  it("migrates legacy simple displayMode to direct toggles", () => {
    const settings = normalizeDisplaySettings({
      displayMode: "simple",
      showHistoryInlineInAdvanced: true,
    });

    expect(settings.showServiceDetailsInline).toBe(false);
    expect(settings.showHistoryInline).toBe(false);
    expect(settings.showAdvancedDiagnostics).toBe(false);
  });

  it("migrates legacy advanced displayMode to direct toggles", () => {
    const settings = normalizeDisplaySettings({
      displayMode: "advanced",
      showHistoryInlineInAdvanced: false,
    });

    expect(settings.showServiceDetailsInline).toBe(true);
    expect(settings.showHistoryInline).toBe(false);
    expect(settings.showAdvancedDiagnostics).toBe(true);
  });

  it("prefers new toggles over legacy displayMode migration", () => {
    const settings = normalizeDisplaySettings({
      displayMode: "advanced",
      showServiceDetailsInline: false,
      showHistoryInline: false,
      showAdvancedDiagnostics: false,
    });

    expect(settings.showServiceDetailsInline).toBe(false);
    expect(settings.showHistoryInline).toBe(false);
    expect(settings.showAdvancedDiagnostics).toBe(false);
  });

  it("creates route alert preferences from global defaults", () => {
    const prefs = createRouteAlertPreferences("337", {
      ...DEFAULT_DISPLAY_SETTINGS.globalAlertDefaults,
      warnEstimatedLateBus: true,
    });

    expect(prefs.routeId).toBe("337");
    expect(prefs.warnEstimatedLateBus).toBe(true);
    expect(prefs.warnLargeGap).toBe(true);
  });
});
