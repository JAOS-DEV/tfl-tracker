import { describe, expect, it } from "vitest";
import {
  getGeolocationDeniedInfo,
  getGeolocationErrorInfo,
} from "@/lib/nearbyStops";

describe("getGeolocationErrorInfo", () => {
  it("returns a friendly permission denied message", () => {
    const error = {
      code: 1,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
      message: "denied",
    } as GeolocationPositionError;

    const info = getGeolocationErrorInfo(error);
    expect(info.title).toMatch(/blocked/i);
    expect(info.message.length).toBeGreaterThan(0);
  });
});

describe("getGeolocationDeniedInfo", () => {
  it("returns actionable guidance", () => {
    const info = getGeolocationDeniedInfo();
    expect(info.title).toMatch(/blocked/i);
    expect(info.message).toMatch(/settings/i);
  });
});
