"use client";

import type { RouteAlertPreferences } from "@/lib/routeAlerts";
import { DEFAULT_LARGE_GAP_MINUTES } from "@/lib/routeAlerts";

interface RouteAlertSettingsProps {
  preferences: RouteAlertPreferences;
  onChange: (preferences: RouteAlertPreferences) => void;
}

export function RouteAlertSettings({
  preferences,
  onChange,
}: RouteAlertSettingsProps): React.ReactElement {
  const update = (patch: Partial<RouteAlertPreferences>) => {
    onChange({ ...preferences, ...patch });
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        In-app alerts
      </p>

      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Warn if largest gap is over</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={60}
            value={preferences.largeGapMinutes}
            disabled={!preferences.warnLargeGap}
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              update({
                largeGapMinutes: Number.isFinite(value)
                  ? value
                  : DEFAULT_LARGE_GAP_MINUTES,
              });
            }}
            className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-right dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="text-zinc-500">min</span>
          <input
            type="checkbox"
            checked={preferences.warnLargeGap}
            onChange={(event) => update({ warnLargeGap: event.target.checked })}
            className="h-5 w-5"
          />
        </div>
      </label>

      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Warn if possible bunching is detected</span>
        <input
          type="checkbox"
          checked={preferences.warnBunching}
          onChange={(event) => update({ warnBunching: event.target.checked })}
          className="h-5 w-5"
        />
      </label>

      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Warn if no live vehicles are detected</span>
        <input
          type="checkbox"
          checked={preferences.warnNoLiveBuses}
          onChange={(event) =>
            update({ warnNoLiveBuses: event.target.checked })
          }
          className="h-5 w-5"
        />
      </label>

      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Warn if prediction data becomes stale</span>
        <input
          type="checkbox"
          checked={preferences.warnStaleData}
          onChange={(event) => update({ warnStaleData: event.target.checked })}
          className="h-5 w-5"
        />
      </label>

      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Warn if a possible ghost is detected</span>
        <input
          type="checkbox"
          checked={preferences.warnPossibleGhost}
          onChange={(event) =>
            update({ warnPossibleGhost: event.target.checked })
          }
          className="h-5 w-5"
        />
      </label>

      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Warn if a prediction disappears</span>
        <input
          type="checkbox"
          checked={preferences.warnPredictionDisappeared}
          onChange={(event) =>
            update({ warnPredictionDisappeared: event.target.checked })
          }
          className="h-5 w-5"
        />
      </label>

      <label className="flex min-h-11 items-center justify-between gap-3">
        <span>Warn if an estimated late bus is over</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={30}
            value={preferences.estimatedLateMinutes}
            disabled={!preferences.warnEstimatedLateBus}
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              update({
                estimatedLateMinutes: Number.isFinite(value) ? value : 4,
              });
            }}
            className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-right dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="text-zinc-500">min</span>
          <input
            type="checkbox"
            checked={preferences.warnEstimatedLateBus}
            onChange={(event) =>
              update({ warnEstimatedLateBus: event.target.checked })
            }
            className="h-5 w-5"
          />
        </div>
      </label>
    </div>
  );
}
