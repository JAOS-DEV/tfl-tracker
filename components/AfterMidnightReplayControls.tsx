import type { AfterMidnightReplayScenario } from "@/lib/tfl/afterMidnightReplay";

interface AfterMidnightReplayControlsProps {
  activeScenario: AfterMidnightReplayScenario | null;
  onSelect: (scenario: AfterMidnightReplayScenario | null) => void;
}

const OPTIONS: Array<{
  scenario: AfterMidnightReplayScenario;
  label: string;
}> = [
  { scenario: "0015", label: "00:15" },
  { scenario: "0045", label: "00:45" },
  { scenario: "0115", label: "01:15" },
  { scenario: "0130", label: "01:30" },
  { scenario: "0230", label: "02:30" },
];

export function AfterMidnightReplayControls({
  activeScenario,
  onSelect,
}: AfterMidnightReplayControlsProps): React.ReactElement {
  return (
    <section className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <div>
        <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
          After-midnight simulation
        </h3>
        <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
          Development only. This is a synthetic reconstruction of known Route 14
          fields, not a recorded TfL response.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => (
          <button
            key={option.scenario}
            type="button"
            aria-pressed={activeScenario === option.scenario}
            onClick={() => onSelect(option.scenario)}
            className="min-h-10 rounded-md border border-amber-400 px-2 py-2 text-xs font-medium dark:border-amber-700"
          >
            Simulate {option.label}
          </button>
        ))}
      </div>
      {activeScenario ? (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="min-h-10 w-full rounded-md border border-zinc-400 px-3 py-2 text-sm"
        >
          Exit simulation
        </button>
      ) : null}
    </section>
  );
}
