import type { RouteVisualMode } from "@/lib/tfl/types";

interface RouteVisualModeToggleProps {
  mode: RouteVisualMode;
  onChange: (mode: RouteVisualMode) => void;
}

const VIEW_OPTIONS = [
  { value: "map", label: "Map" },
  { value: "loop", label: "Loop" },
  { value: "list", label: "List" },
] as const satisfies ReadonlyArray<{
  value: RouteVisualMode;
  label: string;
}>;

export function RouteVisualModeToggle({
  mode,
  onChange,
}: RouteVisualModeToggleProps): React.ReactElement {
  return (
    <div
      className="inline-flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700"
      role="tablist"
      aria-label="Route view"
    >
      {VIEW_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={mode === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-11 rounded-md px-3 py-1.5 text-sm ${
            mode === option.value
              ? "bg-sky-600 text-white"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
