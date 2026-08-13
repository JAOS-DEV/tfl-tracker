import { normalizeRouteSchedule } from "@/lib/ibus/compactScheduleDecode";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import {
  getLocalIbusFixtureVersion,
  readLocalRouteSchedule,
} from "@/lib/ibus/testLocalFixtures";
import {
  buildAfterMidnightReplayFromSchedule,
  type AfterMidnightReplay,
  type AfterMidnightReplayScenario,
} from "@/lib/tfl/afterMidnightReplay";

const REPLAY_ROUTE_ID = "14";

function loadLocalRoute14Schedule(): IbusRouteSchedule | null {
  try {
    const version = getLocalIbusFixtureVersion();
    return normalizeRouteSchedule(
      readLocalRouteSchedule(REPLAY_ROUTE_ID, version),
    );
  } catch {
    return null;
  }
}

/** Server-only: reads local iBus JSON from disk. Do not import from client components. */
export function buildAfterMidnightReplay(
  routeId: string,
  scenario: AfterMidnightReplayScenario,
): AfterMidnightReplay {
  if (routeId.toLowerCase() !== REPLAY_ROUTE_ID) {
    return buildAfterMidnightReplayFromSchedule(routeId, scenario, null);
  }

  return buildAfterMidnightReplayFromSchedule(
    routeId,
    scenario,
    loadLocalRoute14Schedule(),
  );
}
