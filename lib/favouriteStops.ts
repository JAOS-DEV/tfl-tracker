export interface FavouriteStop {
  stopPointId: string;
  name: string;
  stopLetter?: string;
  routesServed?: string[];
  favouritedAt: number;
}

export function migrateFavouriteStops(value: unknown): FavouriteStop[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is FavouriteStop =>
        typeof item === "object" &&
        item !== null &&
        "stopPointId" in item &&
        typeof (item as FavouriteStop).stopPointId === "string" &&
        "name" in item &&
        typeof (item as FavouriteStop).name === "string",
    )
    .map((item) => ({
      stopPointId: item.stopPointId,
      name: item.name,
      stopLetter: item.stopLetter,
      routesServed: item.routesServed,
      favouritedAt: item.favouritedAt ?? Date.now(),
    }));
}

export function toggleFavouriteStop(
  favourites: FavouriteStop[],
  stop: Omit<FavouriteStop, "favouritedAt">,
): FavouriteStop[] {
  const existing = favourites.find(
    (item) => item.stopPointId === stop.stopPointId,
  );
  if (existing) {
    return favourites.filter((item) => item.stopPointId !== stop.stopPointId);
  }

  return [
    {
      ...stop,
      favouritedAt: Date.now(),
    },
    ...favourites,
  ];
}

export function removeFavouriteStop(
  favourites: FavouriteStop[],
  stopPointId: string,
): FavouriteStop[] {
  return favourites.filter((item) => item.stopPointId !== stopPointId);
}

export function isFavouriteStop(
  favourites: FavouriteStop[],
  stopPointId: string,
): boolean {
  return favourites.some((item) => item.stopPointId === stopPointId);
}

export function clearFavouriteStops(): FavouriteStop[] {
  return [];
}
