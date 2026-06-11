import { describe, expect, it } from "vitest";
import {
  buildAppSearchUrl,
  buildRoutesSearchUrl,
  buildStopSearchUrl,
  parseAppUrlState,
  parseRoutesParam,
  serializeRoutesParam,
} from "@/lib/routeUrl";

describe("parseRoutesParam", () => {
  it("returns an empty array for null or blank input", () => {
    expect(parseRoutesParam(null)).toEqual([]);
    expect(parseRoutesParam("")).toEqual([]);
    expect(parseRoutesParam(" , ")).toEqual([]);
  });

  it("parses comma-separated route ids and trims whitespace", () => {
    expect(parseRoutesParam("337, 220 ,14")).toEqual(["337", "220", "14"]);
  });

  it("deduplicates routes case-insensitively", () => {
    expect(parseRoutesParam("337,337,n87,N87")).toEqual(["337", "n87"]);
  });

  it("caps routes at the active route limit", () => {
    expect(parseRoutesParam("1,2,3,4,5")).toEqual(["1", "2", "3"]);
  });
});

describe("serializeRoutesParam", () => {
  it("returns null when there are no routes", () => {
    expect(serializeRoutesParam([])).toBeNull();
  });

  it("serializes unique route ids in order", () => {
    expect(serializeRoutesParam(["337", "220", "14"])).toBe("337,220,14");
  });

  it("deduplicates and trims route ids", () => {
    expect(serializeRoutesParam(["337", " 337 ", "220"])).toBe("337,220");
  });
});

describe("buildRoutesSearchUrl", () => {
  it("builds a shareable home URL", () => {
    expect(buildRoutesSearchUrl(["337", "220"])).toBe("/?routes=337%2C220");
  });

  it("includes the view preference when provided", () => {
    expect(buildRoutesSearchUrl(["337"], "loop")).toBe(
      "/?routes=337&view=loop",
    );
  });

  it("returns the home path when there are no routes", () => {
    expect(buildRoutesSearchUrl([])).toBe("/");
  });
});

describe("buildAppSearchUrl", () => {
  it("builds a stop deep link", () => {
    expect(
      buildAppSearchUrl({
        routeIds: ["337"],
        stopPointId: "490000001A",
      }),
    ).toBe("/?routes=337&stop=490000001A");
  });
});

describe("buildStopSearchUrl", () => {
  it("builds a stop-only share URL", () => {
    expect(buildStopSearchUrl("490000001A")).toBe("/?stop=490000001A");
  });
});

describe("parseAppUrlState", () => {
  it("parses routes, view, and stop params together", () => {
    const params = new URLSearchParams("routes=337,220&view=list&stop=490000001A");
    expect(parseAppUrlState(params)).toEqual({
      routeIds: ["337", "220"],
      view: "list",
      stopPointId: "490000001A",
    });
  });
});
