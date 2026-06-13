import type { VehicleLookupMode } from "@/lib/vehicles/lookupKey";

export interface VehicleEnrichment {
  registration: string | null;
  fleetNumber: string | null;
  fleetCode: string | null;
  operatorId: string | null;
  operatorName: string | null;
  operatorSlug: string | null;
  garageCode: string | null;
  garageName: string | null;
  vehicleTypeName: string | null;
  fuel: string | null;
  isDoubleDecker: boolean;
  isElectric: boolean;
  liveryName: string | null;
  withdrawn: boolean;
  specialFeatures: string | null;
  source: "bustimes";
  fetchedAt: string;
}

export type VehicleEnrichmentStatus = "found" | "not_found" | "unavailable";

export interface VehicleEnrichmentResult {
  queryKey: string;
  queryMode: VehicleLookupMode;
  status: VehicleEnrichmentStatus;
  enrichment: VehicleEnrichment | null;
  message?: string;
}

export interface VehicleEnrichmentBatchResponse {
  results: VehicleEnrichmentResult[];
  fetchedAt: string;
}

export interface VehicleEnrichmentRequest {
  vehicleId?: string;
  vehicleRegistration?: string;
  vehicleFleetReference?: string;
}
