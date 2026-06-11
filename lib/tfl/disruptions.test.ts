import { describe, expect, it } from "vitest";
import {
  chunkStopPointIds,
  cleanDisruptionText,
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

describe("chunkStopPointIds", () => {
  it("deduplicates and chunks stop ids", () => {
    const ids = Array.from({ length: 30 }, (_, index) => `49000000${index}A`);
    const chunks = chunkStopPointIds([ids[0], ids[0], ...ids]);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(25);
    expect(chunks[1]).toHaveLength(5);
  });
});
