import { describe, expect, it } from "vitest";
import {
  looksLikeRouteNumber,
  normalizeDiscoveryQuery,
} from "@/lib/discoverySearch";

describe("discoverySearch", () => {
  it("detects route-number style queries", () => {
    expect(looksLikeRouteNumber("337")).toBe(true);
    expect(looksLikeRouteNumber("N87")).toBe(true);
    expect(looksLikeRouteNumber("Clapham Junction")).toBe(false);
  });

  it("normalizes whitespace in discovery queries", () => {
    expect(normalizeDiscoveryQuery("  Richmond   Bus  ")).toBe("Richmond Bus");
  });
});
