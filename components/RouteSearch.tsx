"use client";

import { useState } from "react";
import type { FavouriteRoute } from "@/lib/favouriteRoutes";
import { formatFriendlyError } from "@/lib/errors";
import type { ActiveRoute, LineSearchResult } from "@/lib/tfl/types";
import {
  MAX_ACTIVE_ROUTES,
  addActiveRoute,
  addRecentRoute,
  removeRecentRoute,
} from "@/lib/storage";

interface RouteSearchProps {
  activeRoutes: ActiveRoute[];
  recentRoutes: ActiveRoute[];
  favouriteRoutes: FavouriteRoute[];
  onActiveRoutesChange: (routes: ActiveRoute[]) => void;
  onRecentRoutesChange: (routes: ActiveRoute[]) => void;
  onRemoveFavourite: (routeId: string) => void;
}

export function RouteSearch({
  activeRoutes,
  recentRoutes,
  favouriteRoutes,
  onActiveRoutesChange,
  onRecentRoutesChange,
  onRemoveFavourite,
}: RouteSearchProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);

  const handleAddRoute = async (routeId: string, routeName: string) => {
    setError(null);
    setErrorAction(null);

    if (activeRoutes.some((route) => route.routeId === routeId)) {
      setError(`Route ${routeId} is already active.`);
      return;
    }

    if (activeRoutes.length >= MAX_ACTIVE_ROUTES) {
      setError(`You can monitor up to ${MAX_ACTIVE_ROUTES} routes at once.`);
      return;
    }

    const route: ActiveRoute = {
      routeId,
      routeName,
      addedAt: Date.now(),
    };

    onActiveRoutesChange(addActiveRoute(activeRoutes, route));
    onRecentRoutesChange(addRecentRoute(recentRoutes, route));
    setQuery("");
  };

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    setIsSearching(true);
    setError(null);
    setErrorAction(null);

    try {
      const response = await fetch(
        `/api/tfl/line-search?query=${encodeURIComponent(trimmed)}`,
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        const friendly = formatFriendlyError(
          new Error(payload.error ?? "Route search failed"),
        );
        setError(friendly.message);
        setErrorAction(friendly.action ?? null);
        return;
      }

      const data = (await response.json()) as { results: LineSearchResult[] };

      if (data.results.length === 0) {
        const friendly = formatFriendlyError(
          new Error(`No bus route found for "${trimmed}".`),
        );
        setError(friendly.message);
        setErrorAction(friendly.action ?? null);
        return;
      }

      const exact = data.results.find(
        (result) => result.id.toLowerCase() === trimmed.toLowerCase(),
      );
      const selected = exact ?? data.results[0];

      await handleAddRoute(selected.id, selected.name);
    } catch (searchError) {
      const friendly = formatFriendlyError(searchError);
      setError(friendly.message);
      setErrorAction(friendly.action ?? null);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Add a bus route
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Enter a route number such as 337, 220, or N87. Share routes with{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          ?routes=337,220
        </code>
        . Up to {MAX_ACTIVE_ROUTES} routes can be active.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleSearch();
            }
          }}
          placeholder="e.g. 337"
          className="min-h-11 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none ring-sky-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={() => {
            void handleSearch();
          }}
          disabled={isSearching || !query.trim()}
          className="min-h-11 rounded-xl bg-sky-600 px-5 font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSearching ? "Searching…" : "Add Route"}
        </button>
      </div>

      {error ? (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400">
          <p>{error}</p>
          {errorAction ? (
            <p className="mt-1 text-red-500/80 dark:text-red-300/80">
              {errorAction}
            </p>
          ) : null}
        </div>
      ) : null}

      {favouriteRoutes.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Favourites
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {favouriteRoutes.map((route) => (
              <div
                key={route.routeId}
                className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-50 px-1 py-1 dark:bg-amber-950/30"
              >
                <button
                  type="button"
                  onClick={() => {
                    void handleAddRoute(route.routeId, route.routeName);
                  }}
                  className="min-h-11 rounded-full px-3 py-2 text-sm hover:bg-amber-100 dark:hover:bg-amber-900/40"
                >
                  ★ {route.routeId} · {route.routeName}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveFavourite(route.routeId)}
                  className="min-h-11 min-w-11 rounded-full text-sm text-amber-700 dark:text-amber-300"
                  aria-label={`Remove ${route.routeId} from favourites`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {recentRoutes.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Recent routes
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recentRoutes.map((route) => (
              <div
                key={route.routeId}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-300 dark:border-zinc-700"
              >
                <button
                  type="button"
                  onClick={() => {
                    void handleAddRoute(route.routeId, route.routeName);
                  }}
                  className="min-h-11 rounded-full px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {route.routeId} · {route.routeName}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onRecentRoutesChange(
                      removeRecentRoute(recentRoutes, route.routeId),
                    )
                  }
                  className="min-h-11 min-w-11 rounded-full text-sm text-zinc-500"
                  aria-label={`Remove ${route.routeId} from recent routes`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
