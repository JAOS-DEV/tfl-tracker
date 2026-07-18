"use client";

import {
  buildMapVehicleAriaLabel,
  formatMapVehicleBadgeLabel,
  formatMapVehiclePrimaryLine,
  formatMapVehicleStatusLine,
  getMapVehicleTone,
  MAP_VEHICLE_BADGE_CLASS,
  MAP_VEHICLE_TONE_BORDER_CLASS,
  MAP_VEHICLE_TONE_DOT_CLASS,
} from "@/lib/mapVehicleList";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

interface MapVehicleListItemProps {
  vehicle: EstimatedVehiclePosition;
  selected?: boolean;
  onSelect: (vehicle: EstimatedVehiclePosition) => void;
}

export function MapVehicleListItem({
  vehicle,
  selected = false,
  onSelect,
}: MapVehicleListItemProps): React.ReactElement {
  const tone = getMapVehicleTone(vehicle);
  const primaryLine = formatMapVehiclePrimaryLine(vehicle);
  const statusLine = formatMapVehicleStatusLine(vehicle);
  const badgeLabel = formatMapVehicleBadgeLabel(vehicle);
  const ariaLabel = buildMapVehicleAriaLabel(vehicle);

  const handleClick = (): void => {
    onSelect(vehicle);
  };

  return (
    <li>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-pressed={selected}
        onClick={handleClick}
        className={`flex min-h-11 w-full items-start gap-2.5 rounded-lg border-l-4 px-2.5 py-2 text-left transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:hover:bg-zinc-800 ${MAP_VEHICLE_TONE_BORDER_CLASS[tone]} ${
          selected
            ? "bg-sky-50 ring-1 ring-sky-300 dark:bg-sky-950/40 dark:ring-sky-700"
            : "bg-transparent"
        }`}
      >
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${MAP_VEHICLE_TONE_DOT_CLASS[tone]}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              {primaryLine}
            </span>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${MAP_VEHICLE_BADGE_CLASS[tone]}`}
              aria-hidden="true"
            >
              {badgeLabel}
            </span>
          </span>
          <span className="block text-xs text-zinc-600 dark:text-zinc-300">
            {statusLine}
          </span>
        </span>
      </button>
    </li>
  );
}
