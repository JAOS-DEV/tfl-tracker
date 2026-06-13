import type { VehicleEnrichmentResult } from "@/lib/vehicles/types";



type CacheStatus = "found" | "not_found" | "unavailable";



interface CacheEntry {

  result: VehicleEnrichmentResult;

  expiresAt: number;

}



const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;

const NO_MATCH_TTL_MS = 6 * 60 * 60 * 1000;

const FAILURE_TTL_MS = 5 * 60 * 1000;



function ttlForStatus(status: CacheStatus): number {

  switch (status) {

    case "found":

      return SUCCESS_TTL_MS;

    case "not_found":

      return NO_MATCH_TTL_MS;

    case "unavailable":

      return FAILURE_TTL_MS;

  }

}



export class VehicleEnrichmentCache {

  private readonly entries = new Map<string, CacheEntry>();



  get(queryKey: string, now = Date.now()): VehicleEnrichmentResult | null {

    const entry = this.entries.get(queryKey);

    if (!entry) {

      return null;

    }



    if (entry.expiresAt <= now) {

      this.entries.delete(queryKey);

      return null;

    }



    return entry.result;

  }



  set(result: VehicleEnrichmentResult, now = Date.now()): void {

    this.entries.set(result.queryKey, {

      result,

      expiresAt: now + ttlForStatus(result.status),

    });

  }



  clear(): void {

    this.entries.clear();

  }

}



export const vehicleEnrichmentCache = new VehicleEnrichmentCache();

