import { formatValidityPeriods } from "@/lib/tfl/disruptions";
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

  const notices =
    status.notices && status.notices.length > 0
      ? status.notices
      : isDisrupted(status) || status.reason || status.disruption
        ? [
            {
              statusSeverity: status.statusSeverity,
              statusSeverityDescription: status.statusSeverityDescription,
              reason: status.reason,
              disruption: status.disruption,
              validityPeriods: status.validityPeriods ?? [],
            },
          ]
        : [];

  if (notices.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {notices.map((notice, index) => {
        const period = formatValidityPeriods(notice.validityPeriods);
        const message = notice.reason ?? notice.disruption;

        return (
          <div
            key={`${notice.statusSeverityDescription}-${index}`}
            className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100"
          >
            <p className="font-semibold">{notice.statusSeverityDescription}</p>
            {period ? <p className="mt-1 text-xs">{period}</p> : null}
            {message ? <p className="mt-1 whitespace-pre-line">{message}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
