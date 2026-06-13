import { describe, expect, it } from "vitest";
import { deriveGarageNoFromBlock } from "@/lib/ibus/keys";

describe("deriveGarageNoFromBlock", () => {
  it("parses 6-digit Block_No with 3-digit Running_No as YYYXXX", () => {
    expect(deriveGarageNoFromBlock("123568", "568")).toBe("123");
    expect(deriveGarageNoFromBlock("350094", "094")).toBe("350");
  });

  it("removes Running_No suffix when Block_No is not 6 digits", () => {
    expect(deriveGarageNoFromBlock("35094", "94")).toBe("350");
  });

  it("does not blindly parse non-matching Block_No values", () => {
    expect(deriveGarageNoFromBlock("35094", "568")).toBeNull();
    expect(deriveGarageNoFromBlock("123", "12")).toBeNull();
  });

  it("prefers Garage_No from XML over derived values", () => {
    expect(deriveGarageNoFromBlock("123568", "568", "999")).toBe("999");
    expect(deriveGarageNoFromBlock("35094", "94", "123")).toBe("123");
  });
});
