import {
  cleanDisruptionText,
  formatDisruptionPeriod,
} from "@/lib/tfl/disruptions";
import type { StopDisruption } from "@/lib/tfl/types";

interface StopDisruptionBannerProps {
  disruption: StopDisruption;
}

export function StopDisruptionBanner({
  disruption,
}: StopDisruptionBannerProps): React.ReactElement {
  const period = formatDisruptionPeriod(disruption.fromDate, disruption.toDate);
  const description = cleanDisruptionText(disruption.description);

  return (
    <div className="rounded-lg border border-red-300/80 bg-red-50 px-3 py-2 text-sm text-red-950 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-100">
      <p className="font-semibold">
        {disruption.type === "Closure" ? "Stop closed" : disruption.type}
      </p>
      {period ? (
        <p className="mt-1 text-xs text-red-800 dark:text-red-200">{period}</p>
      ) : null}
      <p className="mt-2 whitespace-pre-line">{description}</p>
    </div>
  );
}
