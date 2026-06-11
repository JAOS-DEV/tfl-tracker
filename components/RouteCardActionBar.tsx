interface RouteCardActionBarProps {
  onServiceDetails: () => void;
  onHistory: () => void;
  onAlerts: () => void;
  historySummary?: string;
}

export function RouteCardActionBar({
  onServiceDetails,
  onHistory,
  onAlerts,
  historySummary,
}: RouteCardActionBarProps): React.ReactElement {
  const buttonClass =
    "min-h-10 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:text-sm";

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onServiceDetails} className={buttonClass}>
        Service details
      </button>
      <button type="button" onClick={onHistory} className={buttonClass}>
        {historySummary ? `History · ${historySummary}` : "History"}
      </button>
      <button type="button" onClick={onAlerts} className={buttonClass}>
        Alerts
      </button>
    </div>
  );
}
