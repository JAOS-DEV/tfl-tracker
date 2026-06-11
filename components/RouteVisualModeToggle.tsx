import type { RouteVisualMode } from "@/lib/tfl/types";

interface RouteVisualModeToggleProps {
  mode: RouteVisualMode;
  onChange: (mode: RouteVisualMode) => void;
}

export function RouteVisualModeToggle({
  mode,
  onChange,
}: RouteVisualModeToggleProps): React.ReactElement {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
      {(
        [
          { value: "loop", label: "Loop view" },
          { value: "list", label: "List view" },
        ] as const
      ).map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-3 py-1.5 text-sm ${
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
