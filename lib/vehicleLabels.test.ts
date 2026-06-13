import { describe, expect, it } from "vitest";
import {
  formatFleetNumberLabel,
  formatRunningNumberLabel,
  resolveDisplayFleetNumber,
} from "@/lib/vehicleLabels";

describe("vehicleLabels", () => {
  it("formats running number labels with full and short wording", () => {
    expect(formatRunningNumberLabel("136")).toBe("Running number: 136");
    expect(formatRunningNumberLabel("136", { short: true })).toBe(
      "Running no: 136",
    );
  });

  it("formats fleet number labels with full and short wording", () => {
    expect(formatFleetNumberLabel("3085")).toBe("Fleet number: 3085");
    expect(formatFleetNumberLabel("3085", { short: true })).toBe(
      "Fleet no: 3085",
    );
  });

  it("prefers iBus fleet number over vehicle fleet reference", () => {
    expect(
      resolveDisplayFleetNumber({
        ibusFleetNo: "3085",
        vehicleFleetReference: "LTZ1049",
      }),
    ).toBe("3085");
  });
});
