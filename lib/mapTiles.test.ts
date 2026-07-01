import { describe, expect, it } from "vitest";
import { getMapTileConfig } from "@/lib/mapTiles";

describe("getMapTileConfig", () => {
  it("uses OpenStreetMap defaults when env vars are missing", () => {
    expect(getMapTileConfig({})).toEqual({
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "© OpenStreetMap contributors",
    });
  });

  it("reads tile settings from env vars", () => {
    expect(
      getMapTileConfig({
        NEXT_PUBLIC_MAP_TILE_URL: "https://example.com/{z}/{x}/{y}.png",
        NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: "© Example Maps",
      }),
    ).toEqual({
      url: "https://example.com/{z}/{x}/{y}.png",
      attribution: "© Example Maps",
    });
  });
});
