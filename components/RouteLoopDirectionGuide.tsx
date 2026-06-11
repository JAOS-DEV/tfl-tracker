import type { NormalizedRoute } from "@/lib/tfl/types";
import { getDirectionEndpoints } from "@/lib/routePositioning";

interface RouteLoopDirectionGuideProps {
  route: NormalizedRoute;
  orientation: "landscape" | "portrait";
}

export function RouteLoopDirectionGuide({
  route,
  orientation,
}: RouteLoopDirectionGuideProps): React.ReactElement {
  const outbound = getDirectionEndpoints(route, "outbound");
  const inbound = getDirectionEndpoints(route, "inbound");

  if (orientation === "portrait") {
    return (
      <div className="grid grid-cols-2 gap-2 px-3 sm:px-0">
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 dark:border-sky-900 dark:bg-sky-950/40">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Outbound ↓
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
            {outbound.from}
          </p>
          <p className="text-xs text-sky-600 dark:text-sky-400">↓ travels down ↓</p>
          <p className="mt-1 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
            {outbound.to}
          </p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 dark:border-violet-900 dark:bg-violet-950/40">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Inbound ↑
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
            {inbound.from}
          </p>
          <p className="text-xs text-violet-600 dark:text-violet-400">↑ travels up ↑</p>
          <p className="mt-1 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
            {inbound.to}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3 sm:px-0">
      <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 dark:border-sky-900 dark:bg-sky-950/40">
        <p className="max-w-[40%] text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {outbound.from}
        </p>
        <p className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Outbound →
        </p>
        <p className="max-w-[40%] text-right text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {outbound.to}
        </p>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 dark:border-violet-900 dark:bg-violet-950/40">
        <p className="max-w-[40%] text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {inbound.to}
        </p>
        <p className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          ← Inbound
        </p>
        <p className="max-w-[40%] text-right text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {inbound.from}
        </p>
      </div>
    </div>
  );
}
