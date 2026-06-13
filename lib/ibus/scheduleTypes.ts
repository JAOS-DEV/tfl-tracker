export interface IbusScheduledStop {
  sequence: number;
  stopName: string;
  stopCode: string | null;
  naptanId: string | null;
  scheduledTime: string;
  scheduledSeconds: number;
}

export interface IbusScheduledJourney {
  tripId: string;
  operatorCode: string | null;
  blockNo: string;
  blockIdx: string;
  runningNo: string;
  garageNo: string | null;
  direction: string;
  destination: string | null;
  patternIdx: string;
  startTime: string;
  startSeconds: number;
  endSeconds: number;
  journeyType: number;
  serviceDays: number[];
  stops: IbusScheduledStop[];
}

export interface IbusRouteSchedule {
  baseVersion: string;
  routeId: string;
  generatedAt: string;
  /** Legacy v1 field; omitted in compact v2 files. */
  blockServiceDays?: Record<string, number[]>;
  journeys: IbusScheduledJourney[];
}

export type ScheduledGhostConfidence = "high" | "medium" | "low";
