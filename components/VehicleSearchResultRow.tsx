"use client";

import {
  formatVehicleSearchPrimaryLine,
  formatVehicleSearchSecondaryLine,
  type VehicleSearchResult,
} from "@/lib/vehicleSearch";

interface VehicleSearchResultRowProps {
  result: VehicleSearchResult;
  onOpen: (result: VehicleSearchResult) => void;
}

export function VehicleSearchResultRow({
  result,
  onOpen,
}: VehicleSearchResultRowProps): React.ReactElement {
  const primaryLine = formatVehicleSearchPrimaryLine(result);
  const secondaryLine = formatVehicleSearchSecondaryLine(result);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {primaryLine}
        </p>
        {secondaryLine ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {secondaryLine}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onOpen(result)}
        className="min-h-11 shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white"
      >
        Open route
      </button>
    </div>
  );
}
