import { describe, expect, it } from "vitest";
import {
  isFavouriteStop,
  migrateFavouriteStops,
  removeFavouriteStop,
  toggleFavouriteStop,
} from "@/lib/favouriteStops";

describe("migrateFavouriteStops", () => {
  it("returns an empty array for invalid values", () => {
    expect(migrateFavouriteStops(null)).toEqual([]);
    expect(migrateFavouriteStops("bad")).toEqual([]);
  });

  it("preserves structured favourite stop records", () => {
    const favourites = [
      {
        stopPointId: "490000001A",
        name: "Clapham Junction",
        stopLetter: "A",
        routesServed: ["37", "337"],
        favouritedAt: 100,
      },
    ];

    expect(migrateFavouriteStops(favourites)).toEqual(favourites);
  });
});

describe("toggleFavouriteStop", () => {
  it("adds a favourite stop", () => {
    const result = toggleFavouriteStop([], {
      stopPointId: "490000001A",
      name: "Clapham Junction",
      stopLetter: "A",
      routesServed: ["37"],
    });

    expect(result).toEqual([
      expect.objectContaining({
        stopPointId: "490000001A",
        name: "Clapham Junction",
      }),
    ]);
  });

  it("removes an existing favourite stop", () => {
    const favourites = migrateFavouriteStops([
      {
        stopPointId: "490000001A",
        name: "Clapham Junction",
        favouritedAt: 1,
      },
    ]);

    expect(
      toggleFavouriteStop(favourites, {
        stopPointId: "490000001A",
        name: "Clapham Junction",
      }),
    ).toEqual([]);
  });
});

describe("removeFavouriteStop", () => {
  it("removes one favourite without affecting others", () => {
    const favourites = migrateFavouriteStops([
      {
        stopPointId: "490000001A",
        name: "A",
        favouritedAt: 1,
      },
      {
        stopPointId: "490000002B",
        name: "B",
        favouritedAt: 2,
      },
    ]);

    expect(removeFavouriteStop(favourites, "490000001A")).toEqual([
      expect.objectContaining({ stopPointId: "490000002B" }),
    ]);
  });
});

describe("isFavouriteStop", () => {
  it("detects whether a stop is favourited", () => {
    const favourites = migrateFavouriteStops([
      {
        stopPointId: "490000001A",
        name: "A",
        favouritedAt: 1,
      },
    ]);

    expect(isFavouriteStop(favourites, "490000001A")).toBe(true);
    expect(isFavouriteStop(favourites, "490000002B")).toBe(false);
  });
});
