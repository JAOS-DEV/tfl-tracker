import type { RouteStatus } from "@/lib/tfl/types";

interface StatusBannerProps {
  status: RouteStatus | undefined;
}

function isDisrupted(status: RouteStatus): boolean {
  return status.statusSeverity < 10;
}

export function StatusBanner({ status }: StatusBannerProps): React.ReactElement | null {
  if (!status) {
    return null;
  }

  if (!isDisrupted(status) && !status.reason && !status.disruption) {
    return (
      <div className="rounded-lg border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100">
        Service running normally
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-semibold">{status.statusSeverityDescription}</p>
      {status.reason ? <p className="mt-1">{status.reason}</p> : null}
      {status.disruption ? <p className="mt-1">{status.disruption}</p> : null}
    </div>
  );
}
