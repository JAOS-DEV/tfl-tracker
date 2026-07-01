import { describe, expect, it } from "vitest";
import { buildLineArrivalsUrl } from "@/hooks/useLineArrivals";

describe("buildLineArrivalsUrl", () => {
  it("includes replay in development", () => {
    expect(buildLineArrivalsUrl("14", "0230", "development")).toBe(
      "/api/tfl/line-arrivals?routeId=14&replay=0230",
    );
  });

  it("never sends replay in production", () => {
    expect(buildLineArrivalsUrl("14", "0230", "production")).toBe(
      "/api/tfl/line-arrivals?routeId=14",
    );
  });

  it("keeps other active routes live while Route 14 is replayed", () => {
    expect(buildLineArrivalsUrl("22", "0230", "development")).toBe(
      "/api/tfl/line-arrivals?routeId=22",
    );
  });
});
