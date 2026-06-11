import { describe, expect, it } from "vitest";
import {
  areAllRoutesExpanded,
  mergeRouteExpansionState,
  setAllRoutesExpanded,
  shouldRouteStartExpanded,
} from "@/lib/routeCardExpansion";

describe("shouldRouteStartExpanded", () => {
  it("expands the only route by default", () => {
    expect(shouldRouteStartExpanded(0, 1)).toBe(true);
  });

  it("expands only the first route when several are active", () => {
    expect(shouldRouteStartExpanded(0, 3)).toBe(true);
    expect(shouldRouteStartExpanded(1, 3)).toBe(false);
  });
});

describe("mergeRouteExpansionState", () => {
  it("keeps existing expansion state and applies defaults for new routes", () => {
    const merged = mergeRouteExpansionState(
      { "337": false, "220": true },
      ["337", "220", "19"],
    );

    expect(merged).toEqual({
      "337": false,
      "220": true,
      "19": false,
    });
  });
});

describe("areAllRoutesExpanded", () => {
  it("returns false when any route is collapsed", () => {
    expect(
      areAllRoutesExpanded({ "337": true, "220": false }, ["337", "220"]),
    ).toBe(false);
  });

  it("returns true when every route is expanded", () => {
    expect(
      areAllRoutesExpanded({ "337": true, "220": true }, ["337", "220"]),
    ).toBe(true);
  });
});

describe("setAllRoutesExpanded", () => {
  it("collapses or expands every active route", () => {
    expect(setAllRoutesExpanded(["337", "220"], false)).toEqual({
      "337": false,
      "220": false,
    });
  });
});
