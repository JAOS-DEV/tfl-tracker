import { describe, expect, it } from "vitest";
import {
  extractStopSearchItems,
  rawStopSearchResponseSchema,
} from "@/lib/tfl/schemas";
import { normalizeNearbyStops, normalizeStopSearch } from "@/lib/tfl/normalizers";

describe("rawStopSearchResponseSchema", () => {
  it("accepts TfL nearby stop wrapper responses", () => {
    const raw = {
      stopPoints: [
        {
          naptanId: "490000050G",
          commonName: "Clapham Common Station",
          modes: ["bus"],
          distance: 42,
        },
      ],
    };

    const parsed = rawStopSearchResponseSchema.parse(raw);
    const results = normalizeNearbyStops(extractStopSearchItems(parsed));

    expect(results).toHaveLength(1);
    expect(results[0]?.stopPointId).toBe("490000050G");
    expect(results[0]?.name).toBe("Clapham Common Station");
  });

  it("accepts TfL stop search wrapper responses", () => {
    const raw = {
      matches: [
        {
          id: "HUBCLJ",
          name: "Clapham Junction",
          modes: ["bus"],
        },
      ],
    };

    const parsed = rawStopSearchResponseSchema.parse(raw);
    const results = normalizeStopSearch(extractStopSearchItems(parsed));

    expect(results).toHaveLength(1);
    expect(results[0]?.stopPointId).toBe("HUBCLJ");
    expect(results[0]?.name).toBe("Clapham Junction");
  });
});
