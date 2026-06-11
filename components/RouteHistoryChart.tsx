interface RouteHistoryChartProps {
  title: string;
  values: number[];
  color: string;
  unit?: string;
  height?: number;
  periodLabel?: string;
}

export function RouteHistoryChart({
  title,
  values,
  color,
  unit = "",
  height = 72,
  periodLabel = "Last 24 hours",
}: RouteHistoryChartProps): React.ReactElement {
  const width = 280;
  const padding = 8;

  if (values.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium text-zinc-500">{title}</p>
        <p className="text-[11px] text-zinc-400">{periodLabel}</p>
        <p className="mt-2 text-xs text-zinc-400">No data yet</p>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const step =
    values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

  const points = values
    .map((value, index) => {
      const x = padding + index * step;
      const y =
        height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const latest = values[values.length - 1];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-zinc-500">{title}</p>
          <p className="text-[11px] text-zinc-400">{periodLabel}</p>
        </div>
        <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
          {latest}
          {unit}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-2 h-auto w-full"
        role="img"
        aria-label={`${title} chart`}
      >
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
    </div>
  );
}
