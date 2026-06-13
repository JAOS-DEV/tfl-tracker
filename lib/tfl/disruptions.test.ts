import { describe, expect, it } from "vitest";
import {
  chunkStopPointIds,
  cleanDisruptionText,
  filterStopDisruptionsForIds,
  formatDisruptionPeriod,
  mergeStopDisruptions,
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
  it("splits long stop lists into batches of 100", () => {
    const ids = Array.from({ length: 129 }, (_, index) => `490000${index}`);
    const chunks = chunkStopPointIds(ids);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(29);
  });
});

describe("mergeStopDisruptions", () => {
  it("deduplicates disruptions across batches", () => {
    const merged = mergeStopDisruptions([
      [
        {
          naptanId: "490014247W",
          stopName: "Warspite Road",
          type: "Closure",
          description: "Closed",
        },
      ],
      [
        {
          naptanId: "490014247W",
          stopName: "Warspite Road",
          type: "Closure",
          description: "Closed duplicate",
        },
        {
          naptanId: "490099999Z",
          stopName: "Other Stop",
          type: "Closure",
          description: "Closed",
        },
      ],
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0]?.naptanId).toBe("490014247W");
    expect(merged[1]?.naptanId).toBe("490099999Z");
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
