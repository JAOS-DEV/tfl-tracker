import { getLoopHeaderTermini } from "@/lib/directionLabels";
import type { NormalizedRoute } from "@/lib/tfl/types";

interface LoopHeaderDestinationProps {
  route: NormalizedRoute;
}

const ROUTE_BADGE_HEIGHT_CLASS = "h-9";

const destinationNameClass =
  "min-w-0 truncate text-sm font-semibold leading-tight text-zinc-900 dark:text-zinc-100";

function LoopBidirectionalBracketIcon(): React.ReactElement {
  return (
    <svg
      aria-hidden
      className="h-8 w-6 shrink-0 text-zinc-600 dark:text-zinc-300"
      viewBox="0 0 22 32"
      fill="none"
    >
      <path
        d="M 9 6 C 21 6, 21 26, 9 26"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M 1 6 L 9 1.5 L 9 10.5 Z" fill="currentColor" />
      <path d="M 1 26 L 9 21.5 L 9 30.5 Z" fill="currentColor" />
    </svg>
  );
}

export function LoopHeaderDestination({
  route,
}: LoopHeaderDestinationProps): React.ReactElement {
  const { outboundTerminus, inboundTerminus, isSame } =
    getLoopHeaderTermini(route);

  const fullLabel = isSame
    ? outboundTerminus
    : `${outboundTerminus} ↔ ${inboundTerminus}`;

  if (isSame) {
    return (
      <>
        <p
          className={`${ROUTE_BADGE_HEIGHT_CLASS} flex min-w-0 items-center sm:hidden`}
        >
          <span className={destinationNameClass}>{outboundTerminus}</span>
        </p>
        <p
          className={`hidden truncate text-sm font-semibold sm:block sm:text-base dark:text-zinc-100`}
          title={fullLabel}
        >
          {outboundTerminus}
        </p>
      </>
    );
  }

  return (
    <>
      <div
        className={`${ROUTE_BADGE_HEIGHT_CLASS} flex min-w-0 items-center gap-2 sm:hidden`}
        title={fullLabel}
        aria-label={fullLabel}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0">
          <p className={destinationNameClass}>{outboundTerminus}</p>
          <p className={destinationNameClass}>{inboundTerminus}</p>
        </div>
        <LoopBidirectionalBracketIcon />
      </div>

      <p
        className="hidden truncate text-sm font-semibold sm:block sm:text-base dark:text-zinc-100"
        title={`Route loop · ${fullLabel}`}
      >
        <span className="text-zinc-500 dark:text-zinc-400">Route loop · </span>
        {outboundTerminus} ↔ {inboundTerminus}
      </p>
    </>
  );
}

export const routeBadgeHeightClass = ROUTE_BADGE_HEIGHT_CLASS;
