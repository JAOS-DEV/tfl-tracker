"use client";

import { FavouritesSection } from "@/components/FavouritesSection";
import { VehicleSearchSections } from "@/components/VehicleSearchSections";
import { useActiveVehicleSearchCandidates } from "@/hooks/useActiveVehicleSearchCandidates";
import {
  looksLikeRouteNumber,
  normalizeDiscoveryQuery,
} from "@/lib/discoverySearch";
import { formatFriendlyError } from "@/lib/errors";
import type { FavouriteRoute } from "@/lib/favouriteRoutes";
import type { FavouriteStop } from "@/lib/favouriteStops";
import {
  getGeolocationErrorInfo,
  getNextNearbyStopsVisibleCount,
  getVisibleNearbyStops,
  NEARBY_STOPS_PAGE_SIZE,
  requestCurrentPosition,
} from "@/lib/nearbyStops";
import type { StopDetailTarget } from "@/lib/stopDetail";
import { formatStopSearchSubtitle, formatStopTitle } from "@/lib/stopDisplay";
import {
  addActiveRoute,
  addRecentRoute,
  createActiveRoute,
  MAX_ACTIVE_ROUTES,
  removeRecentRoute,
} from "@/lib/storage";
import type {
  ActiveRoute,
  LineSearchResult,
  NearbyStopResult,
  StopSearchResult,
} from "@/lib/tfl/types";
import {
  detectVehicleSearchQueryKinds,
  groupVehicleSearchResults,
  isVehicleOnlyDiscoveryQuery,
  searchActiveVehicleCandidates,
  shouldSearchActiveVehicles,
  VEHICLE_SEARCH_HELP_TEXT,
  VEHICLE_SEARCH_PLACEHOLDER,
  type VehicleSearchResult,
} from "@/lib/vehicleSearch";
import { useMemo, useState } from "react";

type DiscoveryTab = "routes" | "stops" | "nearby";

interface RouteSearchProps {
  activeRoutes: ActiveRoute[];
  recentRoutes: ActiveRoute[];
  favouriteRoutes: FavouriteRoute[];
  favouriteStops: FavouriteStop[];
  onActiveRoutesChange: (routes: ActiveRoute[]) => void;
  onRecentRoutesChange: (routes: ActiveRoute[]) => void;
  onRemoveFavouriteRoute: (routeId: string) => void;
  onToggleFavouriteRoute: (
    route: Pick<ActiveRoute, "routeId" | "routeName">,
  ) => void;
  onToggleFavouriteStop: (stop: Omit<FavouriteStop, "favouritedAt">) => void;
  onRemoveFavouriteStop: (stopPointId: string) => void;
  onOpenStop: (stop: StopDetailTarget) => void;
  onOpenVehicleSearchResult: (result: VehicleSearchResult) => void;
  isFavouriteRoute: (routeId: string) => boolean;
  isFavouriteStop: (stopPointId: string) => boolean;
  isLoadingSavedData?: boolean;
}

interface DiscoveryResults {
  routes: LineSearchResult[];
  stops: StopSearchResult[];
  nearby: NearbyStopResult[];
}

const EMPTY_RESULTS: DiscoveryResults = {
  routes: [],
  stops: [],
  nearby: [],
};

export function RouteSearch({
  activeRoutes,
  recentRoutes,
  favouriteRoutes,
  favouriteStops,
  onActiveRoutesChange,
  onRecentRoutesChange,
  onRemoveFavouriteRoute,
  onToggleFavouriteRoute,
  onToggleFavouriteStop,
  onRemoveFavouriteStop,
  onOpenStop,
  onOpenVehicleSearchResult,
  isFavouriteRoute,
  isFavouriteStop,
  isLoadingSavedData = false,
}: RouteSearchProps): React.ReactElement {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isFindingNearby, setIsFindingNearby] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveryResults>(EMPTY_RESULTS);
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("routes");
  const [hasSearched, setHasSearched] = useState(false);
  const [nearbyVisibleCount, setNearbyVisibleCount] = useState(
    NEARBY_STOPS_PAGE_SIZE,
  );

  const vehicleCandidates = useActiveVehicleSearchCandidates(activeRoutes);

  const normalizedQuery = useMemo(
    () => normalizeDiscoveryQuery(query),
    [query],
  );

  const vehicleSearchResults = useMemo(() => {
    if (!normalizedQuery || !shouldSearchActiveVehicles(normalizedQuery)) {
      return [];
    }

    return searchActiveVehicleCandidates(vehicleCandidates, normalizedQuery);
  }, [normalizedQuery, vehicleCandidates]);

  const groupedVehicleResults = useMemo(
    () => groupVehicleSearchResults(vehicleSearchResults),
    [vehicleSearchResults],
  );

  const queryKinds = useMemo(
    () => detectVehicleSearchQueryKinds(normalizedQuery),
    [normalizedQuery],
  );

  const showLocalVehicleResults =
    normalizedQuery.length >= 2 && shouldSearchActiveVehicles(normalizedQuery);

  const nearbyPage = useMemo(
    () => getVisibleNearbyStops(results.nearby, nearbyVisibleCount),
    [results.nearby, nearbyVisibleCount],
  );

  const defaultTab = useMemo<DiscoveryTab>(() => {
    const normalized = normalizeDiscoveryQuery(query);
    if (!normalized) {
      return "routes";
    }
    return looksLikeRouteNumber(normalized) ? "routes" : "stops";
  }, [query]);

  const handleOpenVehicleResult = (result: VehicleSearchResult) => {
    setError(null);
    setErrorAction(null);
    onOpenVehicleSearchResult(result);
    setQuery("");
    setResults(EMPTY_RESULTS);
    setHasSearched(false);
  };

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

    const route = createActiveRoute(routeId, routeName);

    onActiveRoutesChange(addActiveRoute(activeRoutes, route));
    onRecentRoutesChange(addRecentRoute(recentRoutes, route));
    setQuery("");
    setResults(EMPTY_RESULTS);
    setHasSearched(false);
  };

  const handleSearch = async () => {
    const trimmed = normalizeDiscoveryQuery(query);
    if (!trimmed) {
      return;
    }

    setIsSearching(true);
    setError(null);
    setErrorAction(null);
    setHasSearched(true);

    const vehicleOnly = isVehicleOnlyDiscoveryQuery(trimmed);
    const localVehicleResults = searchActiveVehicleCandidates(
      vehicleCandidates,
      trimmed,
    );

    if (vehicleOnly) {
      setActiveTab("routes");
      setResults(EMPTY_RESULTS);
      setIsSearching(false);
      return;
    }

    setActiveTab(looksLikeRouteNumber(trimmed) ? "routes" : "stops");

    try {
      const shouldFetchRemote =
        queryKinds.includes("route") || queryKinds.includes("location");

      const [routeResponse, stopResponse] = shouldFetchRemote
        ? await Promise.all([
            fetch(`/api/tfl/line-search?query=${encodeURIComponent(trimmed)}`),
            fetch(`/api/tfl/stop-search?query=${encodeURIComponent(trimmed)}`),
          ])
        : [null, null];

      let routeResults: LineSearchResult[] = [];
      let stopResults: StopSearchResult[] = [];

      if (routeResponse?.ok) {
        const routeData = (await routeResponse.json()) as {
          results: LineSearchResult[];
        };
        routeResults = routeData.results;
      }

      if (stopResponse?.ok) {
        const stopData = (await stopResponse.json()) as {
          results: StopSearchResult[];
        };
        stopResults = stopData.results;
      }

      if (
        shouldFetchRemote &&
        routeResponse &&
        stopResponse &&
        !routeResponse.ok &&
        !stopResponse.ok
      ) {
        const friendly = formatFriendlyError(new Error("Search failed"));
        setError(friendly.message);
        setErrorAction(friendly.action ?? null);
        setResults(EMPTY_RESULTS);
        return;
      }

      setResults({
        routes: routeResults,
        stops: stopResults,
        nearby: [],
      });

      const hasRemoteResults =
        routeResults.length > 0 || stopResults.length > 0;
      const hasVehicleResults = localVehicleResults.length > 0;

      if (!hasRemoteResults && !hasVehicleResults) {
        if (!shouldSearchActiveVehicles(trimmed)) {
          const friendly = formatFriendlyError(
            new Error(`No routes or stops found for "${trimmed}".`),
          );
          setError(friendly.message);
          setErrorAction(friendly.action ?? null);
        }
      }
    } catch (searchError) {
      const friendly = formatFriendlyError(searchError);
      setError(friendly.message);
      setErrorAction(friendly.action ?? null);
      setResults(EMPTY_RESULTS);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchNearbyStops = async (position: GeolocationPosition) => {
    try {
      const params = new URLSearchParams({
        lat: position.coords.latitude.toFixed(6),
        lon: position.coords.longitude.toFixed(6),
        radius: "1000",
      });
      const response = await fetch(
        `/api/tfl/nearby-stops?${params.toString()}`,
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        results?: NearbyStopResult[];
      } | null;

      if (!response.ok) {
        const friendly = formatFriendlyError(
          new Error(payload?.error ?? "Nearby stop lookup failed"),
          { nearbyStops: true },
        );
        setError(friendly.message);
        setErrorAction(friendly.action ?? null);
        return;
      }

      if (!payload?.results) {
        const friendly = formatFriendlyError(
          new Error("Nearby stop lookup returned an unexpected response."),
          { nearbyStops: true },
        );
        setError(friendly.message);
        setErrorAction(friendly.action ?? null);
        return;
      }

      setNearbyVisibleCount(NEARBY_STOPS_PAGE_SIZE);
      setResults((current) => ({
        ...current,
        nearby: payload.results ?? [],
      }));

      if (payload.results.length === 0) {
        setError("No nearby bus stops found within about 1 km.");
      }
    } catch (nearbyError) {
      const friendly = formatFriendlyError(nearbyError, { nearbyStops: true });
      setError(friendly.message);
      setErrorAction(friendly.action ?? null);
    } finally {
      setIsFindingNearby(false);
    }
  };

  const handleClearNearby = () => {
    setResults((current) => ({
      ...current,
      nearby: [],
    }));
    setNearbyVisibleCount(NEARBY_STOPS_PAGE_SIZE);
    setError(null);
    setErrorAction(null);
  };

  const handleClearResults = () => {
    setResults(EMPTY_RESULTS);
    setHasSearched(false);
    setNearbyVisibleCount(NEARBY_STOPS_PAGE_SIZE);
    setError(null);
    setErrorAction(null);
  };

  const handleLoadMoreNearby = () => {
    setNearbyVisibleCount((current) =>
      getNextNearbyStopsVisibleCount(current, results.nearby.length),
    );
  };

  const handleFindNearby = () => {
    setIsFindingNearby(true);
    setError(null);
    setErrorAction(null);
    setHasSearched(true);
    setActiveTab("nearby");
    setNearbyVisibleCount(NEARBY_STOPS_PAGE_SIZE);

    requestCurrentPosition(
      (position) => {
        void fetchNearbyStops(position);
      },
      (nearbyError) => {
        setIsFindingNearby(false);

        if (nearbyError instanceof GeolocationPositionError) {
          const info = getGeolocationErrorInfo(nearbyError);
          setError(info.message);
          setErrorAction(info.title);
          return;
        }

        const friendly = formatFriendlyError(nearbyError);
        setError(friendly.message);
        setErrorAction(friendly.action ?? null);
      },
      { maximumAge: 0 },
    );
  };

  const openStop = (
    stop: StopSearchResult | NearbyStopResult | FavouriteStop,
  ) => {
    onOpenStop({
      stopPointId: stop.stopPointId,
      name: stop.name,
      stopLetter: stop.stopLetter,
      routesServed: stop.routesServed,
    });
  };

  const visibleTab = hasSearched ? activeTab : defaultTab;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Discover routes &amp; stops
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Search routes and stops. Registration, fleet, and running-number on
            routes you have open (up to {MAX_ACTIVE_ROUTES} at a time).
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleSearch();
            }
          }}
          placeholder={VEHICLE_SEARCH_PLACEHOLDER}
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
          {isSearching ? "Searching…" : "Search"}
        </button>
      </div>

      <details className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        <summary className="cursor-pointer font-medium text-zinc-600 dark:text-zinc-300">
          Search tips
        </summary>
        <p className="mt-2">{VEHICLE_SEARCH_HELP_TEXT}</p>
      </details>

      {isLoadingSavedData ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Search is ready. Saved routes and favourites are still loading.
        </p>
      ) : null}

      {error ? (
        <div
          className="mt-3 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {errorAction ? <p className="font-semibold">{errorAction}</p> : null}
          <p className={errorAction ? "mt-1" : undefined}>{error}</p>
        </div>
      ) : null}

      {!hasSearched && showLocalVehicleResults ? (
        <div className="mt-4">
          <VehicleSearchSections
            normalizedQuery={normalizedQuery}
            activeRouteCount={activeRoutes.length}
            liveVehicles={groupedVehicleResults.liveVehicles}
            runningNumbers={groupedVehicleResults.runningNumbers}
            showEmptyState
            onOpen={handleOpenVehicleResult}
          />
        </div>
      ) : null}

      {hasSearched ? (
        <div className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-full rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800 sm:w-auto sm:flex-1">
              {(["routes", "stops", "nearby"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  aria-pressed={visibleTab === tab}
                  className={`min-h-10 flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize ${
                    visibleTab === tab
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                      : "text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {tab}
                  {tab === "routes" && results.routes.length > 0
                    ? ` (${results.routes.length})`
                    : ""}
                  {tab === "stops" && results.stops.length > 0
                    ? ` (${results.stops.length})`
                    : ""}
                  {tab === "nearby" && results.nearby.length > 0
                    ? ` (${results.nearby.length})`
                    : ""}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleClearResults}
              className="min-h-11 shrink-0 rounded-xl border border-red-300 px-4 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Clear results
            </button>
          </div>

          {visibleTab === "routes" ? (
            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                {results.routes.length > 0 ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Routes ({results.routes.length})
                  </p>
                ) : null}
                {results.routes.length === 0 ? (
                  hasSearched &&
                  !shouldSearchActiveVehicles(normalizedQuery) ? (
                    <p className="text-sm text-zinc-500">No matching routes.</p>
                  ) : null
                ) : (
                  results.routes.map((route) => (
                    <div
                      key={route.id}
                      className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-red-600 px-2 py-0.5 text-sm font-bold text-white">
                            {route.id}
                          </span>
                          {route.name !== route.id ? (
                            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {route.name}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleAddRoute(route.id, route.name);
                          }}
                          className="min-h-11 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white"
                        >
                          Add route
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onToggleFavouriteRoute({
                              routeId: route.id,
                              routeName: route.name,
                            })
                          }
                          className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                        >
                          {isFavouriteRoute(route.id)
                            ? "★ Favourited"
                            : "☆ Favourite"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <VehicleSearchSections
                normalizedQuery={normalizedQuery}
                activeRouteCount={activeRoutes.length}
                liveVehicles={groupedVehicleResults.liveVehicles}
                runningNumbers={groupedVehicleResults.runningNumbers}
                showEmptyState={hasSearched}
                routeDiscoveryResultCount={results.routes.length}
                onOpen={handleOpenVehicleResult}
              />
            </div>
          ) : null}

          {visibleTab === "stops" ? (
            <div className="mt-3 space-y-2">
              {results.stops.length > 0 ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Stops ({results.stops.length})
                </p>
              ) : null}
              {results.stops.length === 0 ? (
                <p className="text-sm text-zinc-500">No matching stops.</p>
              ) : (
                results.stops.map((stop) => {
                  const subtitle = formatStopSearchSubtitle(stop);

                  return (
                    <div
                      key={stop.stopPointId}
                      className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatStopTitle(stop.name, stop.stopLetter)}
                        </p>
                        {subtitle ? (
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {subtitle}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openStop(stop)}
                          className="min-h-11 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white"
                        >
                          View arrivals
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onToggleFavouriteStop({
                              stopPointId: stop.stopPointId,
                              name: stop.name,
                              stopLetter: stop.stopLetter,
                              routesServed: stop.routesServed,
                            })
                          }
                          className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                        >
                          {isFavouriteStop(stop.stopPointId)
                            ? "★ Favourited"
                            : "☆ Favourite"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          {visibleTab === "nearby" ? (
            <div className="mt-3 space-y-2">
              {results.nearby.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Tap “Find stops near me” below to search nearby bus stops.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-950">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      Showing {nearbyPage.visible.length} of {nearbyPage.total}{" "}
                      nearby stop{nearbyPage.total === 1 ? "" : "s"}
                    </p>
                    <button
                      type="button"
                      onClick={handleClearNearby}
                      className="min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      Clear list
                    </button>
                  </div>

                  {nearbyPage.visible.map((stop) => {
                    const subtitle = formatStopSearchSubtitle(stop);

                    return (
                      <div
                        key={stop.stopPointId}
                        className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {formatStopTitle(stop.name, stop.stopLetter)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {Math.round(stop.distanceMetres)} m away
                            {subtitle ? ` · ${subtitle}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openStop(stop)}
                            className="min-h-11 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white"
                          >
                            View arrivals
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onToggleFavouriteStop({
                                stopPointId: stop.stopPointId,
                                name: stop.name,
                                stopLetter: stop.stopLetter,
                                routesServed: stop.routesServed,
                              })
                            }
                            className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                          >
                            {isFavouriteStop(stop.stopPointId)
                              ? "★ Favourited"
                              : "☆ Favourite"}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {nearbyPage.hasMore ? (
                    <button
                      type="button"
                      onClick={handleLoadMoreNearby}
                      className="min-h-11 w-full rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Load next{" "}
                      {Math.min(
                        NEARBY_STOPS_PAGE_SIZE,
                        nearbyPage.total - nearbyPage.visible.length,
                      )}{" "}
                      stops
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleFindNearby}
            disabled={isFindingNearby}
            className="min-h-11 rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {isFindingNearby ? "Finding nearby stops…" : "Find stops near me"}
          </button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Location is only used to find nearby stops.
          </p>
        </div>
      </div>

      <FavouritesSection
        favouriteRoutes={favouriteRoutes}
        favouriteStops={favouriteStops}
        onAddRoute={(routeId, routeName) => {
          void handleAddRoute(routeId, routeName);
        }}
        onRemoveRoute={onRemoveFavouriteRoute}
        onOpenStop={openStop}
        onRemoveStop={onRemoveFavouriteStop}
      />

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
