import { describe, expect, it } from "vitest";
import { getGeolocationErrorInfo } from "@/lib/nearbyStops";

describe("getGeolocationErrorInfo", () => {
  it("returns a friendly permission denied message", () => {
    const error = {
      code: 1,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
      message: "denied",
    } as GeolocationPositionError;

    expect(getGeolocationErrorInfo(error).title).toMatch(/permission denied/i);
  });
});
