import type { VehicleRegistrationDiagnostic } from "@/lib/tfl/types";
import type { ReactNode } from "react";

interface VehicleRegistrationDiagnosticsProps {
  diagnostics?: VehicleRegistrationDiagnostic[];
}

function Field({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}): React.ReactElement {
  return (
    <div>
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="font-medium text-zinc-800 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

export function VehicleRegistrationDiagnostics({
  diagnostics,
}: VehicleRegistrationDiagnosticsProps): React.ReactElement | null {
  if (!diagnostics?.length) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        Vehicle registration diagnostics
      </h3>
      <div className="space-y-3">
        {diagnostics.map((entry) => (
          <article
            key={entry.vehicleId}
            className="rounded-md border border-zinc-200 p-2 dark:border-zinc-700"
          >
            <p className="mb-2 font-semibold text-zinc-800 dark:text-zinc-100">
              {entry.vehicleId}
            </p>
            <dl className="grid gap-2 sm:grid-cols-2">
              <Field label="Route" value={entry.routeId} />
              <Field
                label="Raw TfL vehicle id"
                value={entry.rawTflVehicleId ?? "unknown"}
              />
              <Field
                label="Normalized registration"
                value={entry.normalizedRegistration ?? "none"}
              />
              <Field
                label="Fleet / bonnet"
                value={
                  entry.ibusFleetNo ??
                  entry.vehicleFleetReference ??
                  "none"
                }
              />
              <Field
                label="Running number"
                value={entry.ibusRunningNo ?? "none"}
              />
              <Field label="Block number" value={entry.ibusBlockNo ?? "none"} />
              <Field label="Operator" value={entry.operatorCode ?? "unknown"} />
              <Field
                label="iBus lookup status"
                value={entry.ibusLookupStatus}
              />
              <Field
                label="Registration source"
                value={entry.registrationSource}
              />
              <Field
                label="Missing reason"
                value={entry.missingReason ?? "none"}
              />
              {entry.lookupNote ? (
                <Field label="Note" value={entry.lookupNote} />
              ) : null}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
