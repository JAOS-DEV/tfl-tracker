import { describe, expect, it } from "vitest";
import {
  normalizeRunningNumber,
  runningNumbersMatch,
} from "@/lib/runningNumber";

describe("normalizeRunningNumber", () => {
  it("normalizes string and numeric running numbers for comparison", () => {
    expect(normalizeRunningNumber("136")).toBe("136");
    expect(normalizeRunningNumber(136)).toBe("136");
    expect(normalizeRunningNumber("0136")).toBe("136");
    expect(normalizeRunningNumber(" 136 ")).toBe("136");
  });

  it("ignores empty values", () => {
    expect(normalizeRunningNumber("")).toBeUndefined();
    expect(normalizeRunningNumber("   ")).toBeUndefined();
    expect(normalizeRunningNumber(null)).toBeUndefined();
    expect(normalizeRunningNumber(undefined)).toBeUndefined();
  });

  it("matches equivalent running numbers", () => {
    expect(runningNumbersMatch("136", "0136")).toBe(true);
    expect(runningNumbersMatch(136, "136")).toBe(true);
    expect(runningNumbersMatch("136", "137")).toBe(false);
    expect(runningNumbersMatch("", "136")).toBe(false);
  });
});
