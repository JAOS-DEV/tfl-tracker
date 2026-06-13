import { z } from "zod";
import { buildVehicleLookupKeys } from "@/lib/vehicles/lookupKey";
import { normalizeRegistration } from "@/lib/vehicles/registration";

const lookupValueSchema = z
  .string()
  .trim()
  .min(2)
  .max(12)
  .transform(normalizeRegistration);

const vehicleLookupRequestSchema = z.object({
  vehicleId: lookupValueSchema.optional(),
  vehicleRegistration: lookupValueSchema.optional(),
});

export const vehicleEnrichmentQuerySchema = z
  .object({
    reg: z.string().trim().optional(),
    regs: z.string().trim().optional(),
    vehicleId: z.string().trim().optional(),
    vehicleIds: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (!value.reg && !value.regs && !value.vehicleId && !value.vehicleIds) {
      context.addIssue({
        code: "custom",
        message: "Provide reg, regs, vehicleId, or vehicleIds",
        path: ["vehicleId"],
      });
    }
  })
  .transform((value) => {
    const requests: Array<{
      vehicleId?: string;
      vehicleRegistration?: string;
    }> = [];

    if (value.vehicleIds) {
      for (const item of value.vehicleIds.split(",")) {
        const vehicleId = item.trim();
        if (vehicleId) {
          requests.push({ vehicleId: normalizeRegistration(vehicleId) });
        }
      }
    } else if (value.vehicleId) {
      requests.push({ vehicleId: normalizeRegistration(value.vehicleId) });
    }

    const legacyValues = value.regs
      ? value.regs.split(",")
      : value.reg
        ? [value.reg]
        : [];

    for (const item of legacyValues) {
      const registration = item.trim();
      if (registration) {
        requests.push({
          vehicleRegistration: normalizeRegistration(registration),
        });
      }
    }

    const deduped = new Map<string, { vehicleId?: string; vehicleRegistration?: string }>();
    for (const request of requests) {
      const key = `${request.vehicleId ?? ""}|${request.vehicleRegistration ?? ""}`;
      deduped.set(key, request);
    }

    return {
      requests: [...deduped.values()].slice(0, 10),
    };
  })
  .pipe(
    z.object({
      requests: z
        .array(vehicleLookupRequestSchema)
        .min(1)
        .max(10),
    }),
  );

export function resolveLookupKeysForRequest(request: {
  vehicleId?: string;
  vehicleRegistration?: string;
}) {
  return buildVehicleLookupKeys(request.vehicleId, request.vehicleRegistration);
}

const bustimesVehicleTypeSchema = z
  .object({
    name: z.string().optional(),
    fuel: z.string().optional(),
    double_decker: z.boolean().optional(),
    electric: z.boolean().optional(),
  })
  .passthrough();

const bustimesOperatorSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    slug: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough()
  .nullable();

const bustimesGarageSchema = z
  .object({
    code: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough()
  .nullable();

const bustimesLiverySchema = z
  .object({
    name: z.string().optional(),
  })
  .passthrough()
  .nullable();

export const bustimesVehicleSchema = z
  .object({
    reg: z.string(),
    fleet_number: z.union([z.string(), z.number(), z.null()]).optional(),
    fleet_code: z.string().nullable().optional(),
    vehicle_type: bustimesVehicleTypeSchema.nullable().optional(),
    operator: bustimesOperatorSchema.optional(),
    garage: bustimesGarageSchema.optional(),
    livery: bustimesLiverySchema.optional(),
    withdrawn: z.boolean().optional(),
    special_features: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();

export const bustimesVehicleListSchema = z.object({
  count: z.number(),
  results: z.array(bustimesVehicleSchema),
});
