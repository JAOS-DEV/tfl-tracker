interface SharedRouteWarningBannerProps {
  title: string;
  message: string;
  action?: string;
  onDismiss: () => void;
}

export function SharedRouteWarningBanner({
  title,
  message,
  action,
  onDismiss,
}: SharedRouteWarningBannerProps): React.ReactElement {
  return (
    <div
      role="status"
      className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm opacity-90">{message}</p>
          {action ? (
            <p className="mt-2 text-sm opacity-80">{action}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
