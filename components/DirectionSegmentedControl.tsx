import { getShortDirectionLabel } from "@/lib/directionLabels";
import type { NormalizedRoute, RouteDirection } from "@/lib/tfl/types";

interface DirectionSegmentedControlProps {
  route: NormalizedRoute;
  selectedDirection: RouteDirection;
  onChange: (direction: RouteDirection) => void;
  variant: "mobile" | "desktop";
}

export function DirectionSegmentedControl({
  route,
  selectedDirection,
  onChange,
  variant,
}: DirectionSegmentedControlProps): React.ReactElement {
  const options: RouteDirection[] = ["outbound", "inbound"];

  return (
    <div
      className="inline-flex w-full max-w-full rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
      role="group"
      aria-label="Route direction"
    >
      {options.map((direction) => {
        const label = getShortDirectionLabel(route, direction, variant);
        const isSelected = selectedDirection === direction;
        return (
          <button
            key={direction}
            type="button"
            onClick={() => onChange(direction)}
            aria-pressed={isSelected}
            title={getShortDirectionLabel(route, direction, "desktop")}
            className={`min-h-9 min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-xs font-medium sm:text-sm ${
              isSelected
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
