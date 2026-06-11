interface ErrorStateProps {
  title: string;
  message: string;
  action?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title,
  message,
  action,
  onRetry,
}: ErrorStateProps): React.ReactElement {
  return (
    <div className="rounded-xl border border-red-300/40 bg-red-50 p-4 text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm opacity-90">{message}</p>
      {action ? (
        <p className="mt-2 text-sm opacity-80">{action}</p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
