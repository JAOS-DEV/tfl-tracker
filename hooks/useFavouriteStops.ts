"use client";

import { useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  migrateFavouriteStops,
  removeFavouriteStop,
  toggleFavouriteStop,
  type FavouriteStop,
} from "@/lib/favouriteStops";
import { STORAGE_KEYS } from "@/lib/storage";

const EMPTY_FAVOURITE_STOPS: FavouriteStop[] = [];

export function useFavouriteStops(): {
  favouriteStops: FavouriteStop[];
  isHydrated: boolean;
  toggleFavourite: (stop: Omit<FavouriteStop, "favouritedAt">) => void;
  removeFavourite: (stopPointId: string) => void;
  clearFavourites: () => void;
} {
  const [favouriteStops, setFavouriteStops, isHydrated] = useLocalStorage(
    STORAGE_KEYS.favouriteStops,
    EMPTY_FAVOURITE_STOPS,
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    setFavouriteStops((current) => migrateFavouriteStops(current));
  }, [isHydrated, setFavouriteStops]);

  return {
    favouriteStops: migrateFavouriteStops(favouriteStops),
    isHydrated,
    toggleFavourite: (stop) => {
      setFavouriteStops((current) =>
        toggleFavouriteStop(migrateFavouriteStops(current), stop),
      );
    },
    removeFavourite: (stopPointId) => {
      setFavouriteStops((current) =>
        removeFavouriteStop(migrateFavouriteStops(current), stopPointId),
      );
    },
    clearFavourites: () => {
      setFavouriteStops([]);
    },
  };
}
