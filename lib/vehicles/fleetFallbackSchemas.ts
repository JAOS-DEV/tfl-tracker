import { z } from "zod";
import { normalizeRegistration } from "@/lib/vehicles/registration";

export const fleetFallbackQuerySchema = z.object({
  reg: z
    .string()
    .trim()
    .min(5)
    .max(8)
    .transform(normalizeRegistration),
});

export interface FleetFallbackResult {
  registration: string;
  status: "found" | "not_found" | "unavailable";
  fleetNo: string | null;
  fleetCode: string | null;
  operatorName: string | null;
  garageCode: string | null;
  vehicleTypeName: string | null;
  fuel: string | null;
  isElectric: boolean;
  isDoubleDecker: boolean;
  withdrawn: boolean;
  source: "bustimes";
}
