import { describe, expect, it } from "vitest";
import {
  formatStopSearchSubtitle,
  formatStopTitle,
  normalizeStopLetterDisplay,
} from "@/lib/stopDisplay";

describe("normalizeStopLetterDisplay", () => {
  it("normalizes TfL indicator labels to a single stop letter", () => {
    expect(normalizeStopLetterDisplay("Stop G")).toBe("G");
    expect(normalizeStopLetterDisplay("A")).toBe("A");
  });

  it("derives a stop letter from standard bus NaPTAN ids", () => {
    expect(normalizeStopLetterDisplay(undefined, "4900000050D")).toBe("D");
    expect(normalizeStopLetterDisplay(undefined, "4900000050E")).toBe("E");
  });

  it("ignores non-letter indicators and hub ids", () => {
    expect(normalizeStopLetterDisplay("Opp")).toBeUndefined();
    expect(normalizeStopLetterDisplay(undefined, "HUBCLJ")).toBeUndefined();
  });
});

describe("formatStopTitle", () => {
  it("appends the stop letter when one is available", () => {
    expect(formatStopTitle("Clapham Common Station", "D")).toBe(
      "Clapham Common Station (D)",
    );
  });
});

describe("formatStopSearchSubtitle", () => {
  it("shows direction and routes instead of internal stop ids", () => {
    expect(
      formatStopSearchSubtitle({
        towards: "Putney",
        routesServed: ["37", "337", "39"],
      }),
    ).toBe("Towards Putney · 37, 337, 39");
  });

  it("returns undefined when there is nothing useful to show", () => {
    expect(
      formatStopSearchSubtitle({
        routesServed: [],
      }),
    ).toBeUndefined();
  });
});
