import fs from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";
import { parseBlockXml } from "@/lib/ibus/parsers";
import {
  buildBlockServiceDays,
  buildRouteSchedule,
  type ScheduleBlockRecord,
} from "@/lib/ibus/scheduleBuilder";
import {
  parseBlockCalendarDayXml,
  parseJourneyDetailXml,
  parseJourneyDriveTimeXml,
  parseJourneyWaitTimeXml,
  parseLineXml,
  parsePatternXml,
  parseStopInPatternXml,
  parseStopPointXml,
} from "@/lib/ibus/scheduleParsers";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import { IBUS_OPERATOR_CODES } from "@/lib/ibus/operators";

const IBUS_ROOT = "https://ibus.data.tfl.gov.uk";

async function fetchBuffer(url: string): Promise<Buffer | null> {
  const response = await fetch(url);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function extractXmlFiles(
  zipBuffer: Buffer,
  matcher: (fileName: string) => boolean,
): Promise<Array<{ name: string; content: string }>> {
  const archive = await unzipper.Open.buffer(zipBuffer);
  const results: Array<{ name: string; content: string }> = [];

  for (const entry of archive.files) {
    if (entry.type !== "File" || !matcher(entry.path)) {
      continue;
    }
    results.push({
      name: entry.path,
      content: (await entry.buffer()).toString("utf8"),
    });
  }

  return results;
}

function toBlockRecords(blocks: ReturnType<typeof parseBlockXml>): ScheduleBlockRecord[] {
  return blocks.map((block) => ({
    blockIdx: block.blockIdx,
    blockNo: block.blockNo,
    runningNo: block.runningNo,
    garageNo: block.garageNo,
    operatorCode: block.operatorCode,
  }));
}

export async function discoverServiceLineNos(
  baseVersion: string,
): Promise<string[]> {
  const lineZip = await fetchBuffer(
    `${IBUS_ROOT}/Base_Version_${baseVersion}/Line_${baseVersion}.zip`,
  );
  if (!lineZip) {
    return [];
  }

  const lineFiles = await extractXmlFiles(lineZip, (name) => /Line/i.test(name));
  const serviceLineNos = new Set<string>();
  for (const file of lineFiles) {
    for (const line of parseLineXml(file.content)) {
      serviceLineNos.add(line.serviceLineNo);
    }
  }
  return [...serviceLineNos].sort((left, right) => left.localeCompare(right));
}

export interface BuildRouteSchedulesOptions {
  baseVersion: string;
  outputRoot: string;
  routeIds: string[];
}

export interface BuildRouteSchedulesResult {
  routesBuilt: string[];
  routesSkipped: string[];
  warnings: string[];
}

export async function buildRouteSchedules(
  options: BuildRouteSchedulesOptions,
): Promise<BuildRouteSchedulesResult> {
  const warnings: string[] = [];
  const routesBuilt: string[] = [];
  const routesSkipped: string[] = [];
  const generatedAt = new Date().toISOString();

  const lineZip = await fetchBuffer(
    `${IBUS_ROOT}/Base_Version_${options.baseVersion}/Line_${options.baseVersion}.zip`,
  );
  const lineMap = new Map<string, string>();
  if (lineZip) {
    const lineFiles = await extractXmlFiles(lineZip, (name) => /Line/i.test(name));
    for (const file of lineFiles) {
      for (const line of parseLineXml(file.content)) {
        lineMap.set(line.contractLineNo, line.serviceLineNo);
      }
    }
  } else {
    warnings.push("Line zip missing; using provided route ids directly");
  }

  const stopPointZip = await fetchBuffer(
    `${IBUS_ROOT}/Base_Version_${options.baseVersion}/Stop_Point_${options.baseVersion}.zip`,
  );
  let stopPoints = {};
  if (stopPointZip) {
    const stopFiles = await extractXmlFiles(stopPointZip, (name) =>
      /Stop_Point/i.test(name),
    );
    for (const file of stopFiles) {
      stopPoints = { ...stopPoints, ...parseStopPointXml(file.content) };
    }
  } else {
    warnings.push("Stop_Point zip missing; route schedules may be incomplete");
  }

  const allBlocks: ScheduleBlockRecord[] = [];
  const allCalendar = [];

  for (const operatorCode of IBUS_OPERATOR_CODES) {
    const scheduleUrl = `${IBUS_ROOT}/Base_Version_${options.baseVersion}/${operatorCode}/schedule_${operatorCode}_${options.baseVersion}.zip`;
    const scheduleZip = await fetchBuffer(scheduleUrl);
    if (!scheduleZip) {
      continue;
    }

    const xmlFiles = await extractXmlFiles(
      scheduleZip,
      (name) =>
        /Journey|Block|CalendarDay/i.test(name) &&
        !/calendar(?!Day)/i.test(name),
    );

    for (const file of xmlFiles) {
      if (
        /(^|\/)Block[^/]*\.xml$/i.test(file.name) &&
        !/CalendarDay/i.test(file.name)
      ) {
        for (const block of toBlockRecords(parseBlockXml(file.content))) {
          allBlocks.push(block);
        }
      }
      if (/Block_CalendarDay/i.test(file.name)) {
        for (const entry of parseBlockCalendarDayXml(file.content)) {
          allCalendar.push(entry);
        }
      }
    }
  }

  const blockServiceDays = buildBlockServiceDays(allCalendar);
  const scheduleDir = path.join(options.outputRoot, "route-schedules");
  await fs.mkdir(scheduleDir, { recursive: true });

  for (const routeId of options.routeIds) {
    const contractLineNo =
      [...lineMap.entries()].find(([, serviceLineNo]) => serviceLineNo === routeId)?.[0] ??
      routeId;
    const patternZip = await fetchBuffer(
      `${IBUS_ROOT}/Base_Version_${options.baseVersion}/Pattern_data_${contractLineNo}_${options.baseVersion}.zip`,
    );

    if (!patternZip) {
      routesSkipped.push(routeId);
      warnings.push(`Pattern data missing for route ${routeId}`);
      continue;
    }

    const patternFiles = await extractXmlFiles(
      patternZip,
      (name) => /Pattern|Stop_In_Pattern/i.test(name),
    );
    const patterns = [];
    const stopsInPattern = [];

    for (const file of patternFiles) {
      if (/Pattern_/i.test(file.name) && !/Stop_In_Pattern/i.test(file.name)) {
        for (const pattern of parsePatternXml(file.content)) {
          patterns.push(pattern);
        }
      }
      if (/Stop_In_Pattern/i.test(file.name)) {
        for (const stop of parseStopInPatternXml(file.content)) {
          stopsInPattern.push(stop);
        }
      }
    }

    const routePatternIds = new Set(
      patterns
        .filter((pattern) => pattern.contractLineNo === routeId)
        .map((pattern) => pattern.patternIdx),
    );
    const routeJourneys = [];
    const routeWaits = [];
    const routeDrives = [];
    const routeJourneyIds = new Set<string>();

    for (const operatorCode of IBUS_OPERATOR_CODES) {
      const scheduleUrl = `${IBUS_ROOT}/Base_Version_${options.baseVersion}/${operatorCode}/schedule_${operatorCode}_${options.baseVersion}.zip`;
      const scheduleZip = await fetchBuffer(scheduleUrl);
      if (!scheduleZip) {
        continue;
      }

      const xmlFiles = await extractXmlFiles(
        scheduleZip,
        (name) => /Journey|Block|CalendarDay/i.test(name),
      );

      for (const file of xmlFiles) {
        if (
          /(^|\/)Journey[^/]*\.xml$/i.test(file.name) &&
          !/drive|wait|calendar/i.test(file.name)
        ) {
          for (const journey of parseJourneyDetailXml(file.content)) {
            if (!routePatternIds.has(journey.patternIdx)) {
              continue;
            }
            routeJourneys.push(journey);
            routeJourneyIds.add(journey.journeyIdx);
          }
        }
        if (/Journey_Wait_Time/i.test(file.name)) {
          for (const wait of parseJourneyWaitTimeXml(file.content)) {
            if (routeJourneyIds.has(wait.journeyIdx)) {
              routeWaits.push(wait);
            }
          }
        }
        if (/Journey_Drive_Time/i.test(file.name)) {
          for (const drive of parseJourneyDriveTimeXml(file.content)) {
            if (routeJourneyIds.has(drive.journeyIdx)) {
              routeDrives.push(drive);
            }
          }
        }
      }
    }

    const schedule: IbusRouteSchedule = buildRouteSchedule({
      baseVersion: options.baseVersion,
      routeId,
      generatedAt,
      patterns,
      stopsInPattern,
      stopPoints,
      journeys: routeJourneys,
      waits: routeWaits,
      drives: routeDrives,
      blocks: allBlocks,
      blockServiceDays,
    });

    if (schedule.journeys.length === 0) {
      routesSkipped.push(routeId);
      continue;
    }

    const outputPath = path.join(scheduleDir, `${routeId}.json`);
    await fs.writeFile(outputPath, `${JSON.stringify(schedule)}\n`, "utf8");
    routesBuilt.push(routeId);
  }

  return { routesBuilt, routesSkipped, warnings };
}
