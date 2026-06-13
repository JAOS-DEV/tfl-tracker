"use client";

import { useQuery } from "@tanstack/react-query";
import { formatLastUpdated } from "@/lib/format";
import { loadIbusManifestClient } from "@/lib/ibusRouteSchedules";

export function IbusDataVersionSection(): React.ReactElement | null {
  const manifestQuery = useQuery({
    queryKey: ["ibus-manifest-settings"],
    queryFn: loadIbusManifestClient,
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const manifest = manifestQuery.data;
  if (!manifest) {
    return null;
  }

  return (
    <section className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
      <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        iBus static data
      </h4>
      <dl className="space-y-1 text-sm">
        <div>
          <dt className="text-zinc-500">iBus static data version</dt>
          <dd className="font-medium">{manifest.baseVersion}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Generated</dt>
          <dd className="font-medium">
            {formatLastUpdated(new Date(manifest.generatedAt))}
          </dd>
        </div>
        {manifest.routeScheduleRoutes?.length ? (
          <div>
            <dt className="text-zinc-500">Route schedules available</dt>
            <dd className="font-medium">
              {manifest.routeScheduleRoutes.join(", ")}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
