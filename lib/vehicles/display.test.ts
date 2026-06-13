import { describe, expect, it } from "vitest";
import { preferFleetDisplay } from "@/lib/vehicles/display";

describe("preferFleetDisplay", () => {
  it("prefers operator-style fleet codes", () => {
    expect(preferFleetDisplay("WHV142", "142")).toBe("WHV142");
  });

  it("falls back to fleet number when fleet code is absent", () => {
    expect(preferFleetDisplay(null, 142)).toBe("142");
  });

  it("uses fleet code when it is the only value", () => {
    expect(preferFleetDisplay("MHV27", null)).toBe("MHV27");
  });
});
