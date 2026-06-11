import { describe, expect, it } from "vitest";
import {
  cleanDisruptionText,
  filterStopDisruptionsForIds,
  formatDisruptionPeriod,
  normalizeStopDisruptions,
} from "@/lib/tfl/disruptions";

describe("cleanDisruptionText", () => {
  it("normalizes escaped line breaks from TfL", () => {
    expect(cleanDisruptionText("Bus Stop Closed\\n    Please use the next stop")).toBe(
      "Bus Stop Closed\nPlease use the next stop",
    );
  });
});

describe("formatDisruptionPeriod", () => {
  it("formats a from/to closure window", () => {
    const formatted = formatDisruptionPeriod(
      "2026-04-18T08:16:00Z",
      "2026-06-13T15:00:00Z",
    );

    expect(formatted).toContain("2026");
    expect(formatted).toContain("–");
  });
});

describe("normalizeStopDisruptions", () => {
  it("maps TfL disrupted points to stop disruptions", () => {
    const disruptions = normalizeStopDisruptions([
      {
        atcoCode: "490014247W",
        fromDate: "2026-04-18T08:16:00Z",
        toDate: "2026-06-13T15:00:00Z",
        description: "Bus Stop Closed\\nPlease use the next stop",
        commonName: "Warspite Road",
        type: "Closure",
      },
    ]);

    expect(disruptions).toEqual([
      {
        naptanId: "490014247W",
        stopName: "Warspite Road",
        type: "Closure",
        description: "Bus Stop Closed\nPlease use the next stop",
        fromDate: "2026-04-18T08:16:00Z",
        toDate: "2026-06-13T15:00:00Z",
        appearance: undefined,
      },
    ]);
  });
});

describe("filterStopDisruptionsForIds", () => {
  it("returns only disruptions for the requested route stops", () => {
    const disruptions = normalizeStopDisruptions([
      {
        atcoCode: "490014247W",
        commonName: "Warspite Road",
        type: "Closure",
        description: "Bus Stop Closed",
      },
      {
        atcoCode: "490099999Z",
        commonName: "Other Stop",
        type: "Closure",
        description: "Closed",
      },
    ]);

    const filtered = filterStopDisruptionsForIds(disruptions, [
      "490014247W",
      "490000001A",
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.naptanId).toBe("490014247W");
  });
});
