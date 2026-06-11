import { describe, expect, it } from "vitest";
import {
  isFavouriteRoute,
  migrateFavouriteRoutes,
  removeFavouriteRoute,
  toggleFavouriteRoute,
} from "@/lib/favouriteRoutes";

describe("migrateFavouriteRoutes", () => {
  it("migrates legacy string ids to favourite route records", () => {
    expect(migrateFavouriteRoutes(["337", "220"])).toEqual([
      expect.objectContaining({ routeId: "337", routeName: "337" }),
      expect.objectContaining({ routeId: "220", routeName: "220" }),
    ]);
  });

  it("preserves structured favourite route records", () => {
    const favourites = [
      { routeId: "337", routeName: "To Richmond", favouritedAt: 100 },
    ];
    expect(migrateFavouriteRoutes(favourites)).toEqual(favourites);
  });
});

describe("toggleFavouriteRoute", () => {
  it("adds a favourite with route id and display name", () => {
    const result = toggleFavouriteRoute([], {
      routeId: "337",
      routeName: "To Richmond",
    });

    expect(result).toEqual([
      expect.objectContaining({
        routeId: "337",
        routeName: "To Richmond",
      }),
    ]);
  });

  it("removes an existing favourite", () => {
    const favourites = migrateFavouriteRoutes([
      { routeId: "337", routeName: "To Richmond", favouritedAt: 1 },
    ]);

    expect(
      toggleFavouriteRoute(favourites, {
        routeId: "337",
        routeName: "To Richmond",
      }),
    ).toEqual([]);
  });
});

describe("removeFavouriteRoute", () => {
  it("removes a favourite without affecting others", () => {
    const favourites = migrateFavouriteRoutes([
      { routeId: "337", routeName: "A", favouritedAt: 1 },
      { routeId: "220", routeName: "B", favouritedAt: 2 },
    ]);

    expect(removeFavouriteRoute(favourites, "337")).toEqual([
      expect.objectContaining({ routeId: "220" }),
    ]);
  });
});

describe("isFavouriteRoute", () => {
  it("detects whether a route is favourited", () => {
    const favourites = migrateFavouriteRoutes([
      { routeId: "337", routeName: "A", favouritedAt: 1 },
    ]);

    expect(isFavouriteRoute(favourites, "337")).toBe(true);
    expect(isFavouriteRoute(favourites, "220")).toBe(false);
  });
});
