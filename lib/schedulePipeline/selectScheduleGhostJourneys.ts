import { isJourneyScheduledForToday } from "@/lib/scheduledGhostBuses";
import { normalizeRunningNumber } from "@/lib/runningNumber";
import type { IbusScheduledJourney } from "@/lib/ibus/scheduleTypes";

/** Consecutive running numbers further apart than this start a new board. */
const RUNNING_NUMBER_CLUSTER_GAP = 40;
/** Ignore small extra-duty groups such as a handful of peak journeys. */
const MIN_DUPLICATE_BOARD_RUNS = 5;
/** Both boards must be a similar size, so a short extra set is not a duplicate. */
const MAX_DUPLICATE_BOARD_SIZE_RATIO = 1.5;
/** Share of the smaller board's departures that must also exist on the other board. */
const MIN_SHARED_DEPARTURE_RATIO = 0.5;

export interface ScheduleGhostBoardSelection {
  journeys: IbusScheduledJourney[];
  droppedRunningNumbers: string[];
  liveMatchedRunningNumbers: string[];
}

export interface SelectScheduleGhostJourneysInput {
  /** Full day of journeys used to recognise duplicate boards. */
  boardJourneys: readonly IbusScheduledJourney[];
  /** Journeys that may become ghosts right now. */
  activeJourneys: readonly IbusScheduledJourney[];
  liveTripIds: readonly string[];
}

interface RunningGroup {
  runningNo: string;
  numericRunningNo: number;
  departureKeys: Set<string>;
  tripIds: Set<string>;
}

interface RunningBoard {
  groups: RunningGroup[];
  departureKeys: Set<string>;
  tripIds: Set<string>;
}

function departureKey(journey: IbusScheduledJourney): string {
  return `${journey.direction}:${journey.startSeconds}`;
}

function compareRunningNumbers(left: string, right: string): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

function groupByRunningNumber(
  journeys: readonly IbusScheduledJourney[],
): RunningGroup[] {
  const groups = new Map<string, RunningGroup>();

  for (const journey of journeys) {
    const runningNo = normalizeRunningNumber(journey.runningNo);
    if (!runningNo || !/^\d+$/.test(runningNo)) {
      continue;
    }

    let group = groups.get(runningNo);
    if (!group) {
      group = {
        runningNo,
        numericRunningNo: Number(runningNo),
        departureKeys: new Set<string>(),
        tripIds: new Set<string>(),
      };
      groups.set(runningNo, group);
    }

    group.departureKeys.add(departureKey(journey));
    if (journey.tripId) {
      group.tripIds.add(journey.tripId);
    }
  }

  return [...groups.values()].sort(
    (left, right) => left.numericRunningNo - right.numericRunningNo,
  );
}

function clusterBoards(groups: readonly RunningGroup[]): RunningBoard[] {
  const boards: RunningBoard[] = [];
  let current: RunningGroup[] = [];

  const pushBoard = (): void => {
    if (current.length === 0) {
      return;
    }
    const departureKeys = new Set<string>();
    const tripIds = new Set<string>();
    for (const group of current) {
      for (const key of group.departureKeys) {
        departureKeys.add(key);
      }
      for (const tripId of group.tripIds) {
        tripIds.add(tripId);
      }
    }
    boards.push({ groups: current, departureKeys, tripIds });
    current = [];
  };

  for (const group of groups) {
    const previous = current[current.length - 1];
    if (
      previous &&
      group.numericRunningNo - previous.numericRunningNo >= RUNNING_NUMBER_CLUSTER_GAP
    ) {
      pushBoard();
    }
    current.push(group);
  }
  pushBoard();

  return boards;
}

function boardsAreDuplicates(left: RunningBoard, right: RunningBoard): boolean {
  const leftRuns = left.groups.length;
  const rightRuns = right.groups.length;
  if (leftRuns < MIN_DUPLICATE_BOARD_RUNS || rightRuns < MIN_DUPLICATE_BOARD_RUNS) {
    return false;
  }

  const sizeRatio = Math.max(leftRuns, rightRuns) / Math.min(leftRuns, rightRuns);
  if (sizeRatio > MAX_DUPLICATE_BOARD_SIZE_RATIO) {
    return false;
  }

  const smaller =
    left.departureKeys.size <= right.departureKeys.size
      ? left.departureKeys
      : right.departureKeys;
  const larger = smaller === left.departureKeys ? right.departureKeys : left.departureKeys;
  if (smaller.size === 0) {
    return false;
  }

  let shared = 0;
  for (const key of smaller) {
    if (larger.has(key)) {
      shared += 1;
    }
  }

  return shared / smaller.size >= MIN_SHARED_DEPARTURE_RATIO;
}

function duplicateBoardGroups(boards: readonly RunningBoard[]): number[][] {
  const parent = boards.map((_, index) => index);

  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      const next = parent[current];
      if (next === undefined) {
        return current;
      }
      const skip = parent[next];
      if (skip !== undefined) {
        parent[current] = skip;
      }
      current = next;
    }
    return current;
  };

  const unite = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot;
    }
  };

  for (let left = 0; left < boards.length; left += 1) {
    for (let right = left + 1; right < boards.length; right += 1) {
      const leftBoard = boards[left];
      const rightBoard = boards[right];
      if (leftBoard && rightBoard && boardsAreDuplicates(leftBoard, rightBoard)) {
        unite(left, right);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let index = 0; index < boards.length; index += 1) {
    const root = find(index);
    const group = groups.get(root);
    if (group) {
      group.push(index);
    } else {
      groups.set(root, [index]);
    }
  }

  return [...groups.values()].filter((group) => group.length > 1);
}

function runningNumbers(board: RunningBoard): string[] {
  return board.groups.map((group) => group.runningNo);
}

/**
 * Drop a duplicate running-number board from schedule ghosts when live trip
 * IDs belong to the other board only. Live matching still uses every journey.
 */
export function selectScheduleGhostJourneys(
  input: SelectScheduleGhostJourneysInput,
): ScheduleGhostBoardSelection {
  const boards = clusterBoards(groupByRunningNumber(input.boardJourneys));
  const liveTripIds = new Set(input.liveTripIds.filter((tripId) => tripId.length > 0));
  const dropped = new Set<string>();
  const liveMatched = new Set<string>();

  for (const group of duplicateBoardGroups(boards)) {
    const hits = group.map((index) => {
      const board = boards[index];
      if (!board) {
        return 0;
      }
      let count = 0;
      for (const tripId of board.tripIds) {
        if (liveTripIds.has(tripId)) {
          count += 1;
        }
      }
      return count;
    });
    const matchedBoards = hits.filter((count) => count > 0).length;
    if (matchedBoards !== 1) {
      continue;
    }

    group.forEach((index, hitIndex) => {
      const board = boards[index];
      if (!board) {
        return;
      }
      if ((hits[hitIndex] ?? 0) > 0) {
        for (const group of board.groups) {
          for (const tripId of group.tripIds) {
            if (liveTripIds.has(tripId)) {
              liveMatched.add(group.runningNo);
              break;
            }
          }
        }
        return;
      }
      for (const runningNo of runningNumbers(board)) {
        dropped.add(runningNo);
      }
    });
  }

  const droppedRunningNumbers = [...dropped].sort(compareRunningNumbers);
  const liveMatchedRunningNumbers = [...liveMatched].sort(compareRunningNumbers);
  if (droppedRunningNumbers.length === 0) {
    return {
      journeys: [...input.activeJourneys],
      droppedRunningNumbers,
      liveMatchedRunningNumbers,
    };
  }

  return {
    journeys: input.activeJourneys.filter((journey) => {
      const runningNo = normalizeRunningNumber(journey.runningNo);
      return !runningNo || !dropped.has(runningNo);
    }),
    droppedRunningNumbers,
    liveMatchedRunningNumbers,
  };
}

export function journeysForDuplicateBoardDetection(
  allJourneys: readonly IbusScheduledJourney[],
  activeJourneys: readonly IbusScheduledJourney[],
  now: Date,
): IbusScheduledJourney[] {
  const activeTripIds = new Set(activeJourneys.map((journey) => journey.tripId));
  const selected = allJourneys.filter(
    (journey) =>
      isJourneyScheduledForToday(journey, now) || activeTripIds.has(journey.tripId),
  );
  const selectedTripIds = new Set(selected.map((journey) => journey.tripId));
  const extras = activeJourneys.filter((journey) => !selectedTripIds.has(journey.tripId));
  return extras.length > 0 ? [...selected, ...extras] : [...selected];
}
