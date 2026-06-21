import type { VehicleRegistrationDiagnostic } from "@/lib/tfl/types";
import type { ReactNode } from "react";

interface VehicleRegistrationDiagnosticsProps {
  diagnostics?: VehicleRegistrationDiagnostic[];
  embedded?: boolean;
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
  embedded = false,
}: VehicleRegistrationDiagnosticsProps): React.ReactElement | null {
  if (!diagnostics?.length) {
    return null;
  }

  const containerClass = embedded
    ? "space-y-3"
    : "space-y-3 rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300";

  return (
    <section className={containerClass}>
      {!embedded ? (
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          Vehicle registration diagnostics
        </h3>
      ) : null}
      <div className="space-y-3">
        {diagnostics.map((entry) => (
          <article
            key={entry.vehicleId}
            className="rounded-md border border-zinc-200 p-2 dark:border-zinc-700"
          >
            <p className="mb-2 font-semibold text-zinc-800 dark:text-zinc-100">
              {entry.normalizedRegistration ?? entry.vehicleId}
            </p>
            <dl className="grid gap-2 sm:grid-cols-2">
              <Field label="Route" value={entry.routeId} />
              <Field
                label="Registration"
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
              <Field label="Vehicle lookup status" value={entry.vehicleLookupStatus} />
              <Field
                label="Vehicle lookup source"
                value={entry.vehicleLookupSource ?? "none"}
              />
              <Field label="Trip id" value={entry.tripId ?? "none"} />
              <Field label="Live baseVersion" value={entry.liveBaseVersion ?? "none"} />
              <Field
                label="Static manifest baseVersion"
                value={entry.staticBaseVersion ?? "none"}
              />
              <Field
                label="Route schedule baseVersion"
                value={entry.routeScheduleBaseVersion ?? "none"}
              />
              <Field
                label="Running shard baseVersion"
                value={entry.runningShardBaseVersion ?? "none"}
              />
              <Field
                label="BaseVersion matches"
                value={
                  entry.baseVersionMatches === undefined
                    ? "unknown"
                    : entry.baseVersionMatches
                      ? "yes"
                      : "no"
                }
              />
              <Field label="Running lookup status" value={entry.runningLookupStatus} />
              {entry.runningLookupNote ? (
                <Field label="Running lookup note" value={entry.runningLookupNote} />
              ) : null}
              <Field
                label="Running lookup shard"
                value={entry.runningLookupShardId ?? "none"}
              />
              <Field
                label="Running lookup key"
                value={entry.runningLookupKey ?? "none"}
              />
              <Field
                label="Running number"
                value={entry.ibusRunningNo ?? "none"}
              />
              <Field label="Block number" value={entry.ibusBlockNo ?? "none"} />
              <Field label="Operator" value={entry.operatorCode ?? "unknown"} />
              <Field
                label="Registration source"
                value={entry.registrationSource}
              />
              <Field
                label="Missing reason"
                value={entry.missingReason ?? "none"}
              />
              {entry.runningLookupFailureReason ? (
                <Field
                  label="Running lookup failure"
                  value={entry.runningLookupFailureReason}
                />
              ) : null}
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
