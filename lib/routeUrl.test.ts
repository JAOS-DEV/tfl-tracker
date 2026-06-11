import { describe, expect, it } from "vitest";
import {
  buildRoutesSearchUrl,
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

  it("returns the home path when there are no routes", () => {
    expect(buildRoutesSearchUrl([])).toBe("/");
  });
});
