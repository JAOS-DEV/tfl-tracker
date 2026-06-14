import { describe, expect, it } from "vitest";
import {
  getLineSearchMatchTier,
  looksLikeRouteNumber,
  normalizeDiscoveryQuery,
  sortLineSearchResults,
} from "@/lib/discoverySearch";
import type { LineSearchResult } from "@/lib/tfl/types";

function line(id: string): LineSearchResult {
  return { id, name: id, modeName: "bus" };
}

describe("discoverySearch", () => {
  it("detects route-number style queries", () => {
    expect(looksLikeRouteNumber("337")).toBe(true);
    expect(looksLikeRouteNumber("N87")).toBe(true);
    expect(looksLikeRouteNumber("Clapham Junction")).toBe(false);
  });

  it("normalizes whitespace in discovery queries", () => {
    expect(normalizeDiscoveryQuery("  Richmond   Bus  ")).toBe("Richmond Bus");
  });

  it("ranks exact route id matches ahead of partial matches", () => {
    expect(getLineSearchMatchTier(line("22"), "22")).toBe(0);
    expect(getLineSearchMatchTier(line("122"), "22")).toBe(2);
    expect(getLineSearchMatchTier(line("220"), "22")).toBe(1);
  });

  it("sorts line search results with exact matches first", () => {
    const results = sortLineSearchResults(
      [line("122"), line("22"), line("220"), line("221")],
      "22",
    );

    expect(results.map((result) => result.id)).toEqual([
      "22",
      "220",
      "221",
      "122",
    ]);
  });

  it("sorts line search results for other overlapping route numbers", () => {
    const results = sortLineSearchResults(
      [line("114"), line("14"), line("214"), line("141")],
      "14",
    );

    expect(results.map((result) => result.id)).toEqual([
      "14",
      "141",
      "114",
      "214",
    ]);
  });
});
