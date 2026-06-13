import { asArray, parseIbusXml, readAttribute, readText } from "@/lib/ibus/xmlUtils";

export interface ParsedJourneyDetail {
  journeyIdx: string;
  blockIdx: string;
  patternIdx: string;
  tripNo: string | null;
  journeyType: number;
  startSeconds: number;
}

export interface ParsedJourneyWait {
  journeyIdx: string;
  stopInPatternIdx: string;
  waitSeconds: number;
}

export interface ParsedJourneyDrive {
  journeyIdx: string;
  fromStopInPatternIdx: string;
  toStopInPatternIdx: string;
  driveSeconds: number;
}

export interface ParsedPattern {
  patternIdx: string;
  contractLineNo: string;
  direction: string;
  patternType: number;
}

export interface ParsedStopInPattern {
  stopInPatternIdx: string;
  patternIdx: string;
  stopPointIdx: string;
  sequenceNo: number;
  timingPointCode: string | null;
  destinationIdx: string | null;
}

export interface ParsedStopPoint {
  stopPointIdx: string;
  stopCode: string | null;
  stopName: string | null;
  naptanId: string | null;
}

export interface ParsedBlockCalendarDay {
  blockIdx: string;
  calendarDay: string;
  runsOnDay: boolean;
}

export interface ParsedContractLine {
  contractLineNo: string;
  serviceLineNo: string;
}

export function parseJourneyDetailXml(xml: string): ParsedJourneyDetail[] {
  const parsed = parseIbusXml<{
    Schedule_Data?: { Journey?: unknown };
  }>(xml);
  const journeys: ParsedJourneyDetail[] = [];

  for (const journey of asArray(parsed.Schedule_Data?.Journey)) {
    if (!journey || typeof journey !== "object") {
      continue;
    }

    const row = journey as Record<string, unknown>;
    const journeyIdx = readAttribute(row, ["Journey_Idx", "aJourney_Idx"]);
    const blockIdx = readAttribute(row, ["Block_Idx", "aBlock_Idx"]);
    const patternIdx = readAttribute(row, ["Pattern_Idx", "aPattern_Idx"]);
    const startText = readText(row.Start_Time as string);
    const typeText = readText(row.Type as string);

    if (!journeyIdx || !blockIdx || !patternIdx || !startText || !typeText) {
      continue;
    }

    journeys.push({
      journeyIdx,
      blockIdx,
      patternIdx,
      tripNo: readText(row.Trip_No_LBSL as string),
      journeyType: Number(typeText),
      startSeconds: Number(startText),
    });
  }

  return journeys;
}

export function parseJourneyWaitTimeXml(xml: string): ParsedJourneyWait[] {
  const parsed = parseIbusXml<{
    Schedule_Data?: { Journey_Wait_Time?: unknown };
  }>(xml);
  const waits: ParsedJourneyWait[] = [];

  for (const wait of asArray(parsed.Schedule_Data?.Journey_Wait_Time)) {
    if (!wait || typeof wait !== "object") {
      continue;
    }

    const row = wait as Record<string, unknown>;
    const journeyIdx = readAttribute(row, ["Journey_Idx", "aJourney_Idx"]);
    const stopInPatternIdx = readAttribute(row, [
      "Stop_In_Pattern_Idx",
      "aStop_In_Pattern_Idx",
    ]);
    const waitText = readText(row.Wait_Time as string);

    if (!journeyIdx || !stopInPatternIdx || !waitText) {
      continue;
    }

    waits.push({
      journeyIdx,
      stopInPatternIdx,
      waitSeconds: Number(waitText),
    });
  }

  return waits;
}

export function parseJourneyDriveTimeXml(xml: string): ParsedJourneyDrive[] {
  const parsed = parseIbusXml<{
    Schedule_Data?: { Journey_Drive_Time?: unknown };
  }>(xml);
  const drives: ParsedJourneyDrive[] = [];

  for (const drive of asArray(parsed.Schedule_Data?.Journey_Drive_Time)) {
    if (!drive || typeof drive !== "object") {
      continue;
    }

    const row = drive as Record<string, unknown>;
    const journeyIdx = readAttribute(row, ["Journey_Idx", "aJourney_Idx"]);
    const fromStopInPatternIdx = readAttribute(row, [
      "Stop_In_Pattern_From_Idx",
      "aStop_In_Pattern_From_Idx",
    ]);
    const toStopInPatternIdx = readAttribute(row, [
      "Stop_In_Pattern_To_Idx",
      "aStop_In_Pattern_To_Idx",
    ]);
    const driveText = readText(row.Drive_Time as string);

    if (
      !journeyIdx ||
      !fromStopInPatternIdx ||
      !toStopInPatternIdx ||
      !driveText
    ) {
      continue;
    }

    drives.push({
      journeyIdx,
      fromStopInPatternIdx,
      toStopInPatternIdx,
      driveSeconds: Number(driveText),
    });
  }

  return drives;
}

export function parsePatternXml(xml: string): ParsedPattern[] {
  const parsed = parseIbusXml<{
    Network_Data?: { Pattern?: unknown };
  }>(xml);
  const patterns: ParsedPattern[] = [];

  for (const pattern of asArray(parsed.Network_Data?.Pattern)) {
    if (!pattern || typeof pattern !== "object") {
      continue;
    }

    const row = pattern as Record<string, unknown>;
    const patternIdx = readAttribute(row, ["Pattern_Idx", "aPattern_Idx"]);
    const contractLineNo = readAttribute(row, [
      "Contract_Line_No",
      "aContract_Line_No",
    ]);
    const direction = readText(row.Direction as string);
    const patternType = readText(row.Type as string);

    if (!patternIdx || !contractLineNo || !direction || !patternType) {
      continue;
    }

    patterns.push({
      patternIdx,
      contractLineNo,
      direction,
      patternType: Number(patternType),
    });
  }

  return patterns;
}

export function parseStopInPatternXml(xml: string): ParsedStopInPattern[] {
  const parsed = parseIbusXml<{
    Network_Data?: { Stop_In_Pattern?: unknown };
  }>(xml);
  const stops: ParsedStopInPattern[] = [];

  for (const stop of asArray(parsed.Network_Data?.Stop_In_Pattern)) {
    if (!stop || typeof stop !== "object") {
      continue;
    }

    const row = stop as Record<string, unknown>;
    const stopInPatternIdx = readAttribute(row, [
      "Stop_In_Pattern_Idx",
      "aStop_In_Pattern_Idx",
    ]);
    const patternIdx = readAttribute(row, ["Pattern_Idx", "aPattern_Idx"]);
    const stopPointIdx = readAttribute(row, [
      "Stop_Point_Idx",
      "aStop_Point_Idx",
    ]);
    const sequenceText = readText(row.Sequence_No as string);

    if (!stopInPatternIdx || !patternIdx || !stopPointIdx || !sequenceText) {
      continue;
    }

    stops.push({
      stopInPatternIdx,
      patternIdx,
      stopPointIdx,
      sequenceNo: Number(sequenceText),
      timingPointCode: readText(row.Timing_Point_Code as string),
      destinationIdx: readAttribute(row, [
        "Destination_Idx",
        "aDestination_Idx",
      ]),
    });
  }

  return stops;
}

export function parseStopPointXml(
  xml: string,
): Record<string, ParsedStopPoint> {
  const parsed = parseIbusXml<{
    Network_Data?: { Stop_Point?: unknown };
  }>(xml);
  const records: Record<string, ParsedStopPoint> = {};

  for (const stop of asArray(parsed.Network_Data?.Stop_Point)) {
    if (!stop || typeof stop !== "object") {
      continue;
    }

    const row = stop as Record<string, unknown>;
    const stopPointIdx = readAttribute(row, [
      "Stop_Point_Idx",
      "aStop_Point_Idx",
    ]);

    if (!stopPointIdx) {
      continue;
    }

    records[stopPointIdx] = {
      stopPointIdx,
      stopCode: readText(row.Stop_Code_LBSL as string),
      stopName: readText(row.Stop_Name as string),
      naptanId: readText(row.NaPTAN_Code as string),
    };
  }

  return records;
}

export function parseLineXml(xml: string): ParsedContractLine[] {
  const parsed = parseIbusXml<{
    Network_Data?: { Line?: unknown };
  }>(xml);
  const lines: ParsedContractLine[] = [];

  for (const line of asArray(parsed.Network_Data?.Line)) {
    if (!line || typeof line !== "object") {
      continue;
    }

    const row = line as Record<string, unknown>;
    const contractLineNo = readAttribute(row, [
      "Contract_Line_No",
      "aContract_Line_No",
    ]);
    const serviceLineNo = readText(row.Service_Line_No as string);

    if (!contractLineNo || !serviceLineNo) {
      continue;
    }

    lines.push({ contractLineNo, serviceLineNo });
  }

  return lines;
}

export function parseBlockCalendarDayXml(
  xml: string,
): ParsedBlockCalendarDay[] {
  const parsed = parseIbusXml<{
    Schedule_Data?: { Block_CalendarDay?: unknown };
  }>(xml);
  const days: ParsedBlockCalendarDay[] = [];

  for (const entry of asArray(parsed.Schedule_Data?.Block_CalendarDay)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const row = entry as Record<string, unknown>;
    const blockIdx = readAttribute(row, ["Block_Idx", "aBlock_Idx"]);
    const calendarDay = readAttribute(row, ["Calendar_Day", "aCalendar_Day"]);
    const runsText = readText(row.Block_Runs_On_Day as string);

    if (!blockIdx || !calendarDay) {
      continue;
    }

    days.push({
      blockIdx,
      calendarDay,
      runsOnDay: runsText === "1",
    });
  }

  return days;
}

export function secondsToHHMM(seconds: number): string {
  const normalized = ((seconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
