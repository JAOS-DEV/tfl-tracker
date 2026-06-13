import { describe, expect, it } from "vitest";
import {
  normalizeRouteId,
  parseRouteScheduleEnv,
  routeScheduleFilename,
} from "@/lib/ibus/importConfig";

describe("ibus import config", () => {
  it("treats missing env as core-only import", () => {
    expect(parseRouteScheduleEnv(undefined)).toEqual({
      mode: "none",
      routeIds: [],
    });
  });

  it("parses selected routes", () => {
    expect(parseRouteScheduleEnv("337,156")).toEqual({
      mode: "selected",
      routeIds: ["337", "156"],
    });
  });

  it("parses all mode", () => {
    expect(parseRouteScheduleEnv("all")).toEqual({
      mode: "all",
      routeIds: [],
    });
  });

  it("parses night and express route ids", () => {
    expect(parseRouteScheduleEnv("N22,X26")).toEqual({
      mode: "selected",
      routeIds: ["N22", "X26"],
    });
  });

  it("normalizes route filenames safely", () => {
    expect(routeScheduleFilename("337")).toBe("337.json");
    expect(routeScheduleFilename("N22")).toBe("N22.json");
    expect(routeScheduleFilename("X26")).toBe("X26.json");
    expect(normalizeRouteId(" 156 ")).toBe("156");
  });
});
