"use client";

import { useQuery } from "@tanstack/react-query";
import { getIbusDetailsForPrediction } from "@/lib/ibusLookup";
import type { IbusDetailsResult, IbusPredictionInput } from "@/lib/ibus/types";
import type { FleetFallbackResult } from "@/lib/vehicles/fleetFallbackSchemas";

const IBUS_STALE_TIME_MS = 24 * 60 * 60 * 1000;
const FLEET_FALLBACK_STALE_TIME_MS = 24 * 60 * 60 * 1000;

async function fetchFleetFallback(
  registration: string,
): Promise<FleetFallbackResult> {
  const response = await fetch(
    `/api/vehicles/fleet-fallback?reg=${encodeURIComponent(registration)}`,
  );

  if (!response.ok) {
    return {
      registration,
      status: "unavailable",
      fleetNo: null,
      fleetCode: null,
      operatorName: null,
      garageCode: null,
      vehicleTypeName: null,
      fuel: null,
      isElectric: false,
      isDoubleDecker: false,
      withdrawn: false,
      source: "bustimes",
    };
  }

  return response.json() as Promise<FleetFallbackResult>;
}

export interface IbusVehicleDetailsState {
  ibusQuery: {
    isLoading: boolean;
    data: IbusDetailsResult | null | undefined;
  };
  fleetFallbackQuery: {
    isLoading: boolean;
    data: FleetFallbackResult | null | undefined;
  };
  displayFleetNo: string | null;
  fleetSourceLabel: string | null;
  runningNo: string | null;
  runningNumberSourceLabel: string | null;
}

export function useIbusVehicleDetails(
  input: IbusPredictionInput | undefined,
  enabled = true,
): IbusVehicleDetailsState {
  const hasLookupInput = Boolean(
    input?.vehicleId || input?.tripId || input?.baseVersion,
  );

  const ibusQuery = useQuery({
    queryKey: [
      "ibus-details",
      input?.vehicleId,
      input?.tripId,
      input?.baseVersion,
    ],
    queryFn: () => getIbusDetailsForPrediction(input!),
    enabled: enabled && hasLookupInput,
    staleTime: IBUS_STALE_TIME_MS,
    gcTime: IBUS_STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const registration = ibusQuery.data?.registration;
  const needsFleetFallback =
    enabled &&
    Boolean(registration) &&
    !ibusQuery.isLoading &&
    ibusQuery.data?.fleetSource !== "tfl-ibus-static";

  const fleetFallbackQuery = useQuery({
    queryKey: ["fleet-fallback", registration],
    queryFn: () => fetchFleetFallback(registration!),
    enabled: needsFleetFallback,
    staleTime: FLEET_FALLBACK_STALE_TIME_MS,
    gcTime: FLEET_FALLBACK_STALE_TIME_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const displayFleetNo =
    ibusQuery.data?.fleetNo ??
    fleetFallbackQuery.data?.fleetNo ??
    null;

  const fleetSourceLabel =
    ibusQuery.data?.fleetSource === "tfl-ibus-static"
      ? "TfL iBus static data"
      : fleetFallbackQuery.data?.status === "found"
        ? "Bustimes fallback data"
        : null;

  const runningNo =
    ibusQuery.data?.runningNumberSource === "tfl-ibus-static"
      ? ibusQuery.data.runningNo ?? null
      : null;

  const runningNumberSourceLabel =
    runningNo ? "TfL iBus static data" : null;

  return {
    ibusQuery: {
      isLoading: ibusQuery.isLoading,
      data: ibusQuery.data,
    },
    fleetFallbackQuery: {
      isLoading: fleetFallbackQuery.isLoading,
      data: fleetFallbackQuery.data,
    },
    displayFleetNo,
    fleetSourceLabel,
    runningNo,
    runningNumberSourceLabel,
  };
}
