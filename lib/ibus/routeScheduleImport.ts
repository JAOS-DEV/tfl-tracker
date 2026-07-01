import fs from "node:fs/promises";
import path from "node:path";
import { parseBlockXml, parseJourneyXml } from "@/lib/ibus/parsers";
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
  type ParsedJourneyDetail,
  type ParsedJourneyDrive,
  type ParsedJourneyWait,
  type ParsedPattern,
  type ParsedStopInPattern,
  type ParsedStopPoint,
} from "@/lib/ibus/scheduleParsers";
import type { IbusRouteSchedule } from "@/lib/ibus/scheduleTypes";
import { routeScheduleFilename } from "@/lib/ibus/importConfig";
import {
  buildCompactRouteSchedule,
  estimateLegacyScheduleSizeBytes,
  serializeCompactRouteSchedule,
} from "@/lib/ibus/compactScheduleBuilder";
import { isForceDownload, readCachedBuffer } from "@/lib/ibus/cache";
import { extractXmlFiles } from "@/lib/ibus/zipExtract";
import type { IbusDownloadUrls } from "@/lib/ibus/download";
import type { IbusFetchContext } from "@/lib/ibus/ibusFetch";
import { fetchIbusZipCached } from "@/lib/ibus/ibusFetch";
import { IBUS_OPERATOR_CODES } from "@/lib/ibus/operators";

function toBlockRecords(
  blocks: ReturnType<typeof parseBlockXml>,
): ScheduleBlockRecord[] {
  return blocks.map((block) => ({
    blockIdx: block.blockIdx,
    blockNo: block.blockNo,
    runningNo: block.runningNo,
    garageNo: block.garageNo,
    operatorCode: block.operatorCode,
  }));
}

export interface ScheduleCorpusStats {
  journeyRecordsParsed: number;
  blockRecordsParsed: number;
  waitRecordsParsed: number;
  driveRecordsParsed: number;
  stopRecordsParsed: number;
  patternRecordsParsed: number;
  operatorZipsDownloaded: string[];
  operatorZipsReusedFromCache: string[];
  operatorZipsSkipped: string[];
}

export interface ScheduleCorpus {
  lineMap: Map<string, string>;
  serviceLineNos: string[];
  stopPoints: Record<string, ParsedStopPoint>;
  allBlocks: ScheduleBlockRecord[];
  blockServiceDays: Record<string, number[]>;
  journeyLinks: Array<{ journeyIdx: string; blockIdx: string }>;
  journeysByPattern: Map<string, ParsedJourneyDetail[]>;
  waitsByJourney: Map<string, ParsedJourneyWait[]>;
  drivesByJourney: Map<string, ParsedJourneyDrive[]>;
  stats: ScheduleCorpusStats;
}

function appendRecords<T>(target: T[], records: T[]): void {
  for (const record of records) {
    target.push(record);
  }
}

export type ScheduleCorpusDepth = "core" | "full";

export interface BuildScheduleCorpusOptions {
  depth?: ScheduleCorpusDepth;
}

export async function buildScheduleCorpus(
  urls: IbusDownloadUrls,
  context: IbusFetchContext,
  options: BuildScheduleCorpusOptions = {},
): Promise<ScheduleCorpus> {
  const depth = options.depth ?? "full";
  const stats: ScheduleCorpusStats = {
    journeyRecordsParsed: 0,
    blockRecordsParsed: 0,
    waitRecordsParsed: 0,
    driveRecordsParsed: 0,
    stopRecordsParsed: 0,
    patternRecordsParsed: 0,
    operatorZipsDownloaded: [],
    operatorZipsReusedFromCache: [],
    operatorZipsSkipped: [],
  };

  const lineMap = new Map<string, string>();
  const lineZip = await fetchIbusZipCached(context, urls.lineZip, "Line zip");
  if (lineZip) {
    const lineFiles = await extractXmlFiles(lineZip, (name) => /Line/i.test(name));
    for (const file of lineFiles) {
      for (const line of parseLineXml(file.content)) {
        lineMap.set(line.contractLineNo, line.serviceLineNo);
      }
    }
  } else {
    context.warnings.push(`Line zip missing: ${urls.lineZip}`);
  }

  const serviceLineNos = [...new Set(lineMap.values())].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );

  let stopPoints: Record<string, ParsedStopPoint> = {};
  if (depth === "full") {
    const stopPointZip = await fetchIbusZipCached(
      context,
      urls.stopPointZip,
      "Stop_Point zip",
    );
    if (stopPointZip) {
      const stopFiles = await extractXmlFiles(stopPointZip, (name) =>
        /Stop_Point/i.test(name),
      );
      for (const file of stopFiles) {
        const parsed = parseStopPointXml(file.content);
        stopPoints = { ...stopPoints, ...parsed };
        stats.stopRecordsParsed += Object.keys(parsed).length;
      }
    } else {
      context.warnings.push(`Stop_Point zip missing: ${urls.stopPointZip}`);
    }
  }

  const allBlocks: ScheduleBlockRecord[] = [];
  const allCalendar = [];
  const journeyLinks: Array<{ journeyIdx: string; blockIdx: string }> = [];
  const journeysByPattern = new Map<string, ParsedJourneyDetail[]>();
  const waitsByJourney = new Map<string, ParsedJourneyWait[]>();
  const drivesByJourney = new Map<string, ParsedJourneyDrive[]>();

  for (const operatorCode of IBUS_OPERATOR_CODES) {
    const scheduleUrl = urls.operatorScheduleZip(operatorCode);
    const cacheRelative = `${operatorCode}/schedule_${operatorCode}_${urls.baseVersion}.zip`;
    const hadCache =
      !isForceDownload() &&
      Boolean(await readCachedBuffer(urls.baseVersion, cacheRelative));

    const scheduleZip = await fetchIbusZipCached(
      context,
      scheduleUrl,
      `schedule zip (${operatorCode})`,
    );

    if (!scheduleZip) {
      stats.operatorZipsSkipped.push(operatorCode);
      context.warnings.push(`Schedule zip missing for operator ${operatorCode}`);
      continue;
    }

    if (hadCache) {
      stats.operatorZipsReusedFromCache.push(operatorCode);
    } else {
      stats.operatorZipsDownloaded.push(operatorCode);
    }

    const xmlFiles = await extractXmlFiles(
      scheduleZip,
      (name) =>
        /Journey|Block|CalendarDay/i.test(name) &&
        !/calendar(?!Day)/i.test(name),
    );

    for (const file of xmlFiles) {
      if (
        /(^|\/)Journey[^/]*\.xml$/i.test(file.name) &&
        !/drive|wait|calendar/i.test(file.name)
      ) {
        if (depth === "full") {
          const parsed = parseJourneyDetailXml(file.content);
          stats.journeyRecordsParsed += parsed.length;
          for (const journey of parsed) {
            journeyLinks.push({
              journeyIdx: journey.journeyIdx,
              blockIdx: journey.blockIdx,
            });
            const existing = journeysByPattern.get(journey.patternIdx) ?? [];
            existing.push(journey);
            journeysByPattern.set(journey.patternIdx, existing);
          }
        } else {
          const parsed = parseJourneyXml(file.content);
          stats.journeyRecordsParsed += parsed.length;
          appendRecords(journeyLinks, parsed);
        }
      }

      if (
        /(^|\/)Block[^/]*\.xml$/i.test(file.name) &&
        !/CalendarDay/i.test(file.name)
      ) {
        const parsed = toBlockRecords(parseBlockXml(file.content));
        stats.blockRecordsParsed += parsed.length;
        appendRecords(allBlocks, parsed);
      }

      if (/Block_CalendarDay/i.test(file.name) && depth === "full") {
        for (const entry of parseBlockCalendarDayXml(file.content)) {
          allCalendar.push(entry);
        }
      }

      if (/Journey_Wait_Time/i.test(file.name) && depth === "full") {
        const parsed = parseJourneyWaitTimeXml(file.content);
        stats.waitRecordsParsed += parsed.length;
        for (const wait of parsed) {
          const existing = waitsByJourney.get(wait.journeyIdx) ?? [];
          existing.push(wait);
          waitsByJourney.set(wait.journeyIdx, existing);
        }
      }

      if (/Journey_Drive_Time/i.test(file.name) && depth === "full") {
        const parsed = parseJourneyDriveTimeXml(file.content);
        stats.driveRecordsParsed += parsed.length;
        for (const drive of parsed) {
          const existing = drivesByJourney.get(drive.journeyIdx) ?? [];
          existing.push(drive);
          drivesByJourney.set(drive.journeyIdx, existing);
        }
      }
    }
  }

  return {
    lineMap,
    serviceLineNos,
    stopPoints,
    allBlocks,
    blockServiceDays: buildBlockServiceDays(allCalendar),
    journeyLinks,
    journeysByPattern,
    waitsByJourney,
    drivesByJourney,
    stats,
  };
}

export async function discoverServiceLineNos(
  urls: IbusDownloadUrls,
  context: IbusFetchContext,
): Promise<string[]> {
  const corpus = await buildScheduleCorpus(urls, context, { depth: "core" });
  return corpus.serviceLineNos;
}

export interface BuildRouteSchedulesOptions {
  baseVersion: string;
  outputRoot: string;
  routeIds: string[];
  corpus: ScheduleCorpus;
  urls: IbusDownloadUrls;
  context: IbusFetchContext;
}

export interface BuildRouteSchedulesResult {
  routesBuilt: string[];
  routesSkipped: string[];
  warnings: string[];
  routeScheduleSizes: Record<string, number>;
  legacyRouteScheduleSizes: Record<string, number>;
  totalRouteScheduleSize: number;
  totalLegacyRouteScheduleSize: number;
  largestRouteSchedule: { routeId: string; sizeBytes: number } | null;
  topLargestRouteSchedules: Array<{ routeId: string; sizeBytes: number }>;
}

export function resolveContractLineNos(
  lineMap: Map<string, string>,
  routeId: string,
): string[] {
  const contractLineNos: string[] = [];

  for (const [contractLineNo, serviceLineNo] of lineMap.entries()) {
    if (serviceLineNo === routeId) {
      contractLineNos.push(contractLineNo);
    }
  }

  return contractLineNos.length > 0 ? contractLineNos : [routeId];
}

function collectRouteJourneyData(
  corpus: ScheduleCorpus,
  routePatternIds: Set<string>,
): {
  journeys: ParsedJourneyDetail[];
  waits: ParsedJourneyWait[];
  drives: ParsedJourneyDrive[];
} {
  const journeys: ParsedJourneyDetail[] = [];
  const waits: ParsedJourneyWait[] = [];
  const drives: ParsedJourneyDrive[] = [];
  const journeyIds = new Set<string>();

  for (const patternIdx of routePatternIds) {
    for (const journey of corpus.journeysByPattern.get(patternIdx) ?? []) {
      journeys.push(journey);
      journeyIds.add(journey.journeyIdx);
    }
  }

  for (const journeyIdx of journeyIds) {
    waits.push(...(corpus.waitsByJourney.get(journeyIdx) ?? []));
    drives.push(...(corpus.drivesByJourney.get(journeyIdx) ?? []));
  }

  return { journeys, waits, drives };
}

export async function buildRouteSchedules(
  options: BuildRouteSchedulesOptions,
): Promise<BuildRouteSchedulesResult> {
  const warnings: string[] = [];
  const routesBuilt: string[] = [];
  const routesSkipped: string[] = [];
  const routeScheduleSizes: Record<string, number> = {};
  const legacyRouteScheduleSizes: Record<string, number> = {};
  const generatedAt = new Date().toISOString();
  const scheduleDir = path.join(options.outputRoot, "route-schedules");
  await fs.mkdir(scheduleDir, { recursive: true });

  for (const routeId of options.routeIds) {
    const outputPath = path.join(scheduleDir, routeScheduleFilename(routeId));
    const contractLineNos = resolveContractLineNos(options.corpus.lineMap, routeId);
    const patterns: ParsedPattern[] = [];
    const stopsInPattern: ParsedStopInPattern[] = [];
    let hasMissingPatternArchive = false;

    for (const contractLineNo of contractLineNos) {
      const patternUrl = options.urls.patternDataZip(contractLineNo);
      const patternZip = await fetchIbusZipCached(
        options.context,
        patternUrl,
        `Pattern data (${routeId}: ${contractLineNo})`,
      );

      if (!patternZip) {
        hasMissingPatternArchive = true;
        warnings.push(
          `Pattern data missing for route ${routeId} contract ${contractLineNo}; partial schedule not published`,
        );
        continue;
      }

      const patternFiles = await extractXmlFiles(
        patternZip,
        (name) => /Pattern|Stop_In_Pattern/i.test(name),
      );

      for (const file of patternFiles) {
        if (/Pattern_/i.test(file.name) && !/Stop_In_Pattern/i.test(file.name)) {
          const parsed = parsePatternXml(file.content);
          options.corpus.stats.patternRecordsParsed += parsed.length;
          patterns.push(...parsed);
        }
        if (/Stop_In_Pattern/i.test(file.name)) {
          stopsInPattern.push(...parseStopInPatternXml(file.content));
        }
      }
    }

    if (hasMissingPatternArchive) {
      await fs.rm(outputPath, { force: true });
      routesSkipped.push(routeId);
      continue;
    }

    const contractLineNoSet = new Set(contractLineNos);
    const routePatternIds = new Set(
      patterns
        .filter((pattern) => contractLineNoSet.has(pattern.contractLineNo))
        .map((pattern) => pattern.patternIdx),
    );

    const { journeys, waits, drives } = collectRouteJourneyData(
      options.corpus,
      routePatternIds,
    );

    const schedule: IbusRouteSchedule = buildRouteSchedule({
      baseVersion: options.baseVersion,
      routeId,
      contractLineNos,
      generatedAt,
      patterns,
      stopsInPattern,
      stopPoints: options.corpus.stopPoints,
      journeys,
      waits,
      drives,
      blocks: options.corpus.allBlocks,
      blockServiceDays: options.corpus.blockServiceDays,
    });

    if (schedule.journeys.length === 0) {
      await fs.rm(outputPath, { force: true });
      routesSkipped.push(routeId);
      warnings.push(
        `No scheduled journeys found for route ${routeId}; existing schedule removed`,
      );
      continue;
    }

    const compactSchedule = buildCompactRouteSchedule(schedule);
    const json = serializeCompactRouteSchedule(compactSchedule);
    await fs.writeFile(outputPath, json, "utf8");
    const sizeBytes = Buffer.byteLength(json, "utf8");
    const legacySizeBytes = estimateLegacyScheduleSizeBytes(schedule);
    routeScheduleSizes[routeId] = sizeBytes;
    legacyRouteScheduleSizes[routeId] = legacySizeBytes;
    routesBuilt.push(routeId);
  }

  let totalRouteScheduleSize = 0;
  let totalLegacyRouteScheduleSize = 0;
  let largestRouteSchedule: { routeId: string; sizeBytes: number } | null = null;
  const sizeRanking: Array<{ routeId: string; sizeBytes: number }> = [];

  for (const [routeId, sizeBytes] of Object.entries(routeScheduleSizes)) {
    totalRouteScheduleSize += sizeBytes;
    totalLegacyRouteScheduleSize += legacyRouteScheduleSizes[routeId] ?? 0;
    sizeRanking.push({ routeId, sizeBytes });
    if (!largestRouteSchedule || sizeBytes > largestRouteSchedule.sizeBytes) {
      largestRouteSchedule = { routeId, sizeBytes };
    }
  }

  sizeRanking.sort((left, right) => right.sizeBytes - left.sizeBytes);

  return {
    routesBuilt,
    routesSkipped,
    warnings,
    routeScheduleSizes,
    legacyRouteScheduleSizes,
    totalRouteScheduleSize,
    totalLegacyRouteScheduleSize,
    largestRouteSchedule,
    topLargestRouteSchedules: sizeRanking.slice(0, 10),
  };
}
