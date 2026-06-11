import type { ActiveRoute } from "@/lib/tfl/types";

export interface FavouriteRoute {
  routeId: string;
  routeName: string;
  favouritedAt: number;
}

export function isLegacyFavouriteList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "string"
  );
}

export function migrateFavouriteRoutes(value: unknown): FavouriteRoute[] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.length === 0) {
    return [];
  }

  if (isLegacyFavouriteList(value)) {
    return value.map((routeId) => ({
      routeId,
      routeName: routeId,
      favouritedAt: Date.now(),
    }));
  }

  return value
    .filter(
      (item): item is FavouriteRoute =>
        typeof item === "object" &&
        item !== null &&
        "routeId" in item &&
        typeof (item as FavouriteRoute).routeId === "string",
    )
    .map((item) => ({
      routeId: item.routeId,
      routeName: item.routeName || item.routeId,
      favouritedAt: item.favouritedAt ?? Date.now(),
    }));
}

export function toggleFavouriteRoute(
  favourites: FavouriteRoute[],
  route: Pick<ActiveRoute, "routeId" | "routeName">,
): FavouriteRoute[] {
  const existing = favourites.find((item) => item.routeId === route.routeId);
  if (existing) {
    return favourites.filter((item) => item.routeId !== route.routeId);
  }

  return [
    {
      routeId: route.routeId,
      routeName: route.routeName,
      favouritedAt: Date.now(),
    },
    ...favourites,
  ];
}

export function removeFavouriteRoute(
  favourites: FavouriteRoute[],
  routeId: string,
): FavouriteRoute[] {
  return favourites.filter((item) => item.routeId !== routeId);
}

export function updateFavouriteRouteName(
  favourites: FavouriteRoute[],
  routeId: string,
  routeName: string,
): FavouriteRoute[] {
  return favourites.map((item) =>
    item.routeId === routeId ? { ...item, routeName } : item,
  );
}

export function isFavouriteRoute(
  favourites: FavouriteRoute[],
  routeId: string,
): boolean {
  return favourites.some((item) => item.routeId === routeId);
}
