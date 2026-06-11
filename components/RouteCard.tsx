"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { BusDetailsModal } from "@/components/BusDetailsModal";
import { DirectionSegmentedControl } from "@/components/DirectionSegmentedControl";
import { ErrorState } from "@/components/ErrorState";
import { RouteCardActionBar } from "@/components/RouteCardActionBar";
import { RouteCardMoreMenu } from "@/components/RouteCardMoreMenu";
import { RouteCardSkeleton } from "@/components/LoadingSkeleton";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";
import { RouteAlertBadges } from "@/components/RouteAlertBadges";
import { RouteAlertSettings } from "@/components/RouteAlertSettings";
import { RouteDiagram } from "@/components/RouteDiagram";
import { RouteHistoryPanel } from "@/components/RouteHistoryPanel";
import { ServiceHealthCard } from "@/components/ServiceHealthCard";
import { StatusChipRow } from "@/components/StatusChipRow";
import { useRouteHistoryRecorder } from "@/hooks/useRouteHistoryRecorder";
import { useRouteIntelligence } from "@/hooks/useRouteIntelligence";
import { RouteVisualModeToggle } from "@/components/RouteVisualModeToggle";
import { SchematicRouteLoop } from "@/components/SchematicRouteLoop";
import { StatusBanner } from "@/components/StatusBanner";
import { StopArrivalsModal } from "@/components/StopArrivalsModal";
import { useLineStatus } from "@/hooks/useLineStatus";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useRouteHistory } from "@/hooks/useRouteHistory";
import {
  LoopHeaderDestination,
  routeBadgeHeightClass,
} from "@/components/LoopHeaderDestination";
import { getRouteCardHeaderLabel } from "@/lib/directionLabels";
import { formatFriendlyError } from "@/lib/errors";
import {
  createRouteAlertPreferences,
  type DisplaySettings,
} from "@/lib/displaySettings";
import {
  evaluateRouteAlerts,
  type RouteAlertPreferences,
} from "@/lib/routeAlerts";
import { buildServiceHealthSummary } from "@/lib/serviceHealthSummary";
import { getDirectionLabel } from "@/lib/routePositioning";
import { toStopDetailTarget } from "@/lib/stopDetail";
import { buildRoutesSearchUrl } from "@/lib/routeUrl";
import type {
  ActiveRoute,
  EstimatedVehiclePosition,
  NormalizedStop,
  RouteDirection,
  RouteVisualMode,
} from "@/lib/tfl/types";

interface RouteCardProps {
  activeRoute: ActiveRoute;
  allActiveRoutes: ActiveRoute[];
  displaySettings: DisplaySettings;
  initialVisualMode?: RouteVisualMode;
  onRemove: (routeId: string) => void;
  isFavourite: boolean;
  onToggleFavourite: (route: Pick<ActiveRoute, "routeId" | "routeName">) => void;
  alertPreferences?: RouteAlertPreferences;
  onAlertPreferencesChange: (preferences: RouteAlertPreferences) => void;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

type SheetType = "service" | "history" | "alerts" | "routeInfo" | null;

export function RouteCard({
  activeRoute,
  allActiveRoutes,
  displaySettings,
  initialVisualMode,
  onRemove,
  isFavourite,
  onToggleFavourite,
  alertPreferences,
  onAlertPreferencesChange,
  isExpanded,
  onExpandedChange,
}: RouteCardProps): React.ReactElement {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const isOnline = useOnlineStatus();
  const [visualMode, setVisualMode] = useState<RouteVisualMode>(
    initialVisualMode ?? displaySettings.defaultVisualMode,
  );
  const [selectedDirection, setSelectedDirection] =
    useState<RouteDirection>("outbound");
  const [selectedStop, setSelectedStop] = useState<NormalizedStop | null>(null);
  const [selectedVehicle, setSelectedVehicle] =
    useState<EstimatedVehiclePosition | null>(null);
  const [openSheet, setOpenSheet] = useState<SheetType>(null);
  const {
    route,
    sequenceQuery,
    arrivalsQuery,
    intelligence,
  } = useRouteIntelligence(activeRoute.routeId);
  const statusQuery = useLineStatus(activeRoute.routeId);
  const { dailyStats, hydrated: historyHydrated } = useRouteHistory(
    activeRoute.routeId,
  );

  const vehicles = useMemo(
    () => intelligence?.vehicles ?? [],
    [intelligence?.vehicles],
  );
  const serviceHealth = intelligence?.metrics;

  const preferences =
    alertPreferences ??
    createRouteAlertPreferences(
      activeRoute.routeId,
      displaySettings.globalAlertDefaults,
    );

  const userAlerts = useMemo(() => {
    if (!serviceHealth) {
      return [];
    }
    return evaluateRouteAlerts(serviceHealth, preferences);
  }, [serviceHealth, preferences]);

  const statusChips = useMemo(() => {
    if (!serviceHealth) {
      return [];
    }
    const summary = buildServiceHealthSummary(serviceHealth, {
      isFetching: arrivalsQuery.isFetching,
      isStale: serviceHealth.isDataStale,
    });
    return summary.chips.map((chip) => ({
      id: chip.id,
      label: chip.label,
      variant: chip.variant,
      showLiveDot: chip.id === "live",
    }));
  }, [serviceHealth, arrivalsQuery.isFetching]);

  useRouteHistoryRecorder(
    activeRoute.routeId,
    route?.routeName ?? activeRoute.routeName,
    intelligence,
    arrivalsQuery.dataUpdatedAt,
  );

  const selectedVehicleWithConfidence = useMemo(() => {
    if (!selectedVehicle) {
      return null;
    }
    return (
      vehicles.find(
        (vehicle) => vehicle.vehicleId === selectedVehicle.vehicleId,
      ) ?? selectedVehicle
    );
  }, [selectedVehicle, vehicles]);

  const historySummary =
    historyHydrated && dailyStats.snapshotCount > 0
      ? `${dailyStats.snapshotCount} today`
      : undefined;

  const shareUrl =
    typeof window !== "undefined"
      ? new URL(
          buildRoutesSearchUrl(
            allActiveRoutes.map((item) => item.routeId),
            visualMode,
          ),
          window.location.origin,
        ).toString()
      : buildRoutesSearchUrl(
          allActiveRoutes.map((item) => item.routeId),
          visualMode,
        );

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  };

  if (sequenceQuery.isLoading) {
    return <RouteCardSkeleton />;
  }

  if (sequenceQuery.isError || !route) {
    const friendly = formatFriendlyError(sequenceQuery.error, {
      isOffline: !isOnline,
    });
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <ErrorState
          title={friendly.title}
          message={friendly.message}
          action={friendly.action}
          onRetry={() => {
            void sequenceQuery.refetch();
          }}
        />
        <button
          type="button"
          onClick={() => onRemove(activeRoute.routeId)}
          className="mt-3 min-h-11 text-sm text-zinc-500 underline"
        >
          Remove route
        </button>
      </div>
    );
  }

  const listHeaderDestination = getRouteCardHeaderLabel(route, {
    visualMode: "list",
    selectedDirection,
    variant: isMobile ? "mobile" : "desktop",
  });

  const showHistoryInline = displaySettings.showHistoryInline;
  const showServiceInline = displaySettings.showServiceDetailsInline;

  const handleCollapsedHeaderActivate = () => {
    if (!isExpanded) {
      onExpandedChange(true);
    }
  };

  const handleCollapsedHeaderKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!isExpanded && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onExpandedChange(true);
    }
  };

  return (
    <>
      <article
        id={`route-card-${activeRoute.routeId}`}
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <header
          className={`sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 ${
            isExpanded ? "" : "cursor-pointer"
          }`}
          onClick={handleCollapsedHeaderActivate}
          onKeyDown={handleCollapsedHeaderKeyDown}
          role={isExpanded ? undefined : "button"}
          tabIndex={isExpanded ? undefined : 0}
          aria-expanded={isExpanded}
        >
          <div
            className={`flex gap-2 ${
              visualMode === "loop" ? "items-center" : "items-start"
            }`}
          >
            <span
              className={`flex ${routeBadgeHeightClass} shrink-0 items-center rounded-xl bg-red-600 px-3 text-lg font-bold text-white shadow-sm sm:px-4 sm:text-xl`}
            >
              {activeRoute.routeId}
            </span>
            <div className="min-w-0 flex-1">
              {visualMode === "loop" ? (
                <LoopHeaderDestination route={route} />
              ) : (
                <p className="truncate text-sm font-semibold text-zinc-900 sm:text-base dark:text-zinc-100">
                  {listHeaderDestination}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavourite({
                  routeId: activeRoute.routeId,
                  routeName: route.routeName,
                });
              }}
              aria-label={
                isFavourite ? "Remove from favourites" : "Add to favourites"
              }
              className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-lg ${
                isFavourite
                  ? "text-amber-500"
                  : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {isFavourite ? "★" : "☆"}
            </button>
            <div onClick={(event) => event.stopPropagation()}>
              <RouteCardMoreMenu
                isExpanded={isExpanded}
                onToggleExpanded={() => onExpandedChange(!isExpanded)}
              isFavourite={isFavourite}
              onToggleFavourite={() =>
                onToggleFavourite({
                  routeId: activeRoute.routeId,
                  routeName: route.routeName,
                })
              }
              onRemove={() => onRemove(activeRoute.routeId)}
              onShare={() => {
                void handleShare();
              }}
              onOpenAlerts={() => setOpenSheet("alerts")}
              onOpenRouteInfo={() => setOpenSheet("routeInfo")}
              />
            </div>
          </div>

          <div className="mt-2">
            <StatusChipRow chips={statusChips} />
          </div>

          {userAlerts.length > 0 ? (
            <div className="mt-2">
              <RouteAlertBadges alerts={userAlerts} compact />
            </div>
          ) : null}
        </header>

        {isExpanded ? (
          <div
            className={
              visualMode === "loop" ? "space-y-3 sm:space-y-4" : "space-y-4 p-4"
            }
          >
            <div
              className={
                visualMode === "loop" ? "space-y-3 px-3 pt-3 sm:px-4 sm:pt-4" : ""
              }
            >
              <StatusBanner status={statusQuery.data} />

              {arrivalsQuery.isError ? (
                <ErrorState
                  title={
                    formatFriendlyError(arrivalsQuery.error, {
                      isOffline: !isOnline,
                    }).title
                  }
                  message={
                    formatFriendlyError(arrivalsQuery.error, {
                      isOffline: !isOnline,
                    }).message
                  }
                  action={
                    formatFriendlyError(arrivalsQuery.error, {
                      isOffline: !isOnline,
                    }).action
                  }
                  onRetry={() => {
                    void arrivalsQuery.refetch();
                  }}
                />
              ) : null}
            </div>

            {visualMode === "loop" ? (
              <SchematicRouteLoop
                route={route}
                vehicles={vehicles}
                onStopSelect={setSelectedStop}
                onBusSelect={setSelectedVehicle}
                selectedStopId={selectedStop?.naptanId ?? null}
                selectedVehicleId={selectedVehicle?.vehicleId ?? null}
              />
            ) : (
              <div className="px-4">
                <DirectionSegmentedControl
                  route={route}
                  selectedDirection={selectedDirection}
                  onChange={setSelectedDirection}
                  variant={isMobile ? "mobile" : "desktop"}
                />
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {getDirectionLabel(route, selectedDirection)}
                  </h3>
                  <RouteDiagram
                    route={route}
                    direction={selectedDirection}
                    predictions={arrivalsQuery.data?.predictions ?? []}
                    onStopSelect={setSelectedStop}
                  />
                </div>
              </div>
            )}

            <div
              className={`space-y-3 ${
                visualMode === "loop" ? "px-3 sm:px-4" : ""
              }`}
            >
              <RouteVisualModeToggle mode={visualMode} onChange={setVisualMode} />

              <RouteCardActionBar
                onServiceDetails={() => setOpenSheet("service")}
                onHistory={() => setOpenSheet("history")}
                onAlerts={() => setOpenSheet("alerts")}
                historySummary={historySummary}
              />

              {showServiceInline && serviceHealth ? (
                <ServiceHealthCard
                  route={route}
                  metrics={serviceHealth}
                  compact={visualMode === "loop"}
                  variant="full"
                />
              ) : null}

              {showHistoryInline ? (
                <RouteHistoryPanel routeId={activeRoute.routeId} />
              ) : null}
            </div>

            <p
              className={`text-xs text-zinc-500 sm:text-sm dark:text-zinc-400 ${
                visualMode === "loop" ? "px-3 pb-3 sm:px-4 sm:pb-4" : "px-4 pb-4"
              }`}
            >
              Positions and schedule status are estimated.
            </p>
          </div>
        ) : (
          <div className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Tap this route header or open the ⋯ menu to expand the live loop,
            stop list, and service details.
          </div>
        )}
      </article>

      {openSheet === "service" && serviceHealth ? (
        <MobileBottomSheet
          title="Service details"
          titleId="service-details-title"
          onClose={() => setOpenSheet(null)}
        >
          <ServiceHealthCard
            route={route}
            metrics={serviceHealth}
            variant="full"
          />
        </MobileBottomSheet>
      ) : null}

      {openSheet === "history" ? (
        <MobileBottomSheet
          title="Local history"
          titleId="route-history-title"
          onClose={() => setOpenSheet(null)}
        >
          <RouteHistoryPanel
            routeId={activeRoute.routeId}
            defaultExpanded
            showHeader={false}
          />
        </MobileBottomSheet>
      ) : null}

      {openSheet === "alerts" ? (
        <MobileBottomSheet
          title="Alert settings"
          titleId="route-alerts-title"
          onClose={() => setOpenSheet(null)}
        >
          <RouteAlertSettings
            preferences={preferences}
            onChange={(next) => onAlertPreferencesChange(next)}
          />
        </MobileBottomSheet>
      ) : null}

      {openSheet === "routeInfo" ? (
        <MobileBottomSheet
          title="Route info"
          titleId="route-info-title"
          onClose={() => setOpenSheet(null)}
        >
          <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            <p>
              <strong className="text-zinc-900 dark:text-zinc-100">
                Route {activeRoute.routeId}
              </strong>{" "}
              — {route.routeName}
            </p>
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                Outbound
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {getDirectionLabel(route, "outbound")}
              </p>
            </div>
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                Inbound
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {getDirectionLabel(route, "inbound")}
              </p>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Predictions refresh roughly every 30 seconds while the app is
              open.
            </p>
          </div>
        </MobileBottomSheet>
      ) : null}

      <StopArrivalsModal
        stop={selectedStop ? toStopDetailTarget(selectedStop) : null}
        activeRouteIds={allActiveRoutes.map((item) => item.routeId)}
        highlightRouteId={activeRoute.routeId}
        vehicles={vehicles}
        onClose={() => setSelectedStop(null)}
      />

      <BusDetailsModal
        vehicle={selectedVehicleWithConfidence}
        onClose={() => setSelectedVehicle(null)}
      />
    </>
  );
}
