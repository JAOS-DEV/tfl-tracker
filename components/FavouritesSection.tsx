"use client";

import type { FavouriteRoute } from "@/lib/favouriteRoutes";
import type { FavouriteStop } from "@/lib/favouriteStops";

interface FavouritesSectionProps {
  favouriteRoutes: FavouriteRoute[];
  favouriteStops: FavouriteStop[];
  onAddRoute: (routeId: string, routeName: string) => void;
  onRemoveRoute: (routeId: string) => void;
  onOpenStop: (stop: FavouriteStop) => void;
  onRemoveStop: (stopPointId: string) => void;
}

export function FavouritesSection({
  favouriteRoutes,
  favouriteStops,
  onAddRoute,
  onRemoveRoute,
  onOpenStop,
  onRemoveStop,
}: FavouritesSectionProps): React.ReactElement | null {
  if (favouriteRoutes.length === 0 && favouriteStops.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Favourites
      </p>

      {favouriteRoutes.length > 0 ? (
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Routes</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {favouriteRoutes.map((route) => (
              <div
                key={route.routeId}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-400/40 bg-amber-50 px-1 py-1 dark:bg-amber-950/30"
              >
                <button
                  type="button"
                  onClick={() => onAddRoute(route.routeId, route.routeName)}
                  className="min-h-11 max-w-full truncate rounded-full px-3 py-2 text-sm hover:bg-amber-100 dark:hover:bg-amber-900/40"
                >
                  ★ {route.routeId}
                  {route.routeName !== route.routeId
                    ? ` · ${route.routeName}`
                    : ""}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveRoute(route.routeId)}
                  className="min-h-11 min-w-11 shrink-0 rounded-full text-sm text-amber-700 dark:text-amber-300"
                  aria-label={`Remove route ${route.routeId} from favourites`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {favouriteStops.length > 0 ? (
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Stops</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {favouriteStops.map((stop) => (
              <div
                key={stop.stopPointId}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-violet-400/40 bg-violet-50 px-1 py-1 dark:bg-violet-950/30"
              >
                <button
                  type="button"
                  onClick={() => onOpenStop(stop)}
                  className="min-h-11 max-w-full truncate rounded-full px-3 py-2 text-left text-sm hover:bg-violet-100 dark:hover:bg-violet-900/40"
                >
                  ★ {stop.name}
                  {stop.stopLetter ? ` (${stop.stopLetter})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveStop(stop.stopPointId)}
                  className="min-h-11 min-w-11 shrink-0 rounded-full text-sm text-violet-700 dark:text-violet-300"
                  aria-label={`Remove ${stop.name} from favourite stops`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
