import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRouteSchedules,
  resolveContractLineNos,
  type ScheduleCorpus,
} from "@/lib/ibus/routeScheduleImport";
import { fetchIbusZipCached } from "@/lib/ibus/ibusFetch";
import { extractXmlFiles } from "@/lib/ibus/zipExtract";

vi.mock("@/lib/ibus/ibusFetch", () => ({
  fetchIbusZipCached: vi.fn(),
}));

vi.mock("@/lib/ibus/zipExtract", () => ({
  extractXmlFiles: vi.fn(),
}));

const temporaryDirectories: string[] = [];

function createSplitServiceCorpus(): ScheduleCorpus {
  return {
    lineMap: new Map([
      ["14", "14"],
      ["N14", "14"],
    ]),
    serviceLineNos: ["14"],
    stopPoints: {
      stop: {
        stopPointIdx: "stop",
        stopCode: "A",
        stopName: "Russell Square",
        naptanId: "490000200E",
      },
    },
    allBlocks: [
      {
        blockIdx: "day-block",
        blockNo: "day",
        runningNo: "1",
        garageNo: null,
        operatorCode: "LG",
      },
      {
        blockIdx: "night-block",
        blockNo: "night",
        runningNo: "2",
        garageNo: null,
        operatorCode: "LG",
      },
    ],
    blockServiceDays: { "day-block": [1], "night-block": [1] },
    journeyLinks: [],
    journeysByPattern: new Map([
      [
        "day-pattern",
        [
          {
            journeyIdx: "day-journey",
            blockIdx: "day-block",
            patternIdx: "day-pattern",
            tripNo: "1",
            journeyType: 1,
            startSeconds: 82_800,
          },
        ],
      ],
      [
        "night-pattern",
        [
          {
            journeyIdx: "night-journey",
            blockIdx: "night-block",
            patternIdx: "night-pattern",
            tripNo: "2",
            journeyType: 1,
            startSeconds: 95_400,
          },
        ],
      ],
    ]),
    waitsByJourney: new Map(),
    drivesByJourney: new Map(),
    stats: {
      journeyRecordsParsed: 0,
      blockRecordsParsed: 0,
      waitRecordsParsed: 0,
      driveRecordsParsed: 0,
      stopRecordsParsed: 0,
      patternRecordsParsed: 0,
      operatorZipsDownloaded: [],
      operatorZipsReusedFromCache: [],
      operatorZipsSkipped: [],
    },
  };
}

function mockPatternArchiveExtraction(): void {
  vi.mocked(extractXmlFiles).mockImplementation(async (archive, matcher) => {
    const contractLineNo = archive.toString();
    const prefix = contractLineNo === "N14" ? "night" : "day";
    return [
      {
        name: `Pattern_${contractLineNo}.xml`,
        content: `<Network_Data><Pattern aPattern_Idx="${prefix}-pattern" aContract_Line_No="${contractLineNo}"><Direction>1</Direction><Type>1</Type></Pattern></Network_Data>`,
      },
      {
        name: `Stop_In_Pattern_${contractLineNo}.xml`,
        content: `<Network_Data><Stop_In_Pattern aStop_In_Pattern_Idx="${prefix}-stop" aPattern_Idx="${prefix}-pattern" aStop_Point_Idx="stop"><Sequence_No>1</Sequence_No><Timing_Point_Code>A</Timing_Point_Code></Stop_In_Pattern></Network_Data>`,
      },
    ].filter((file) => matcher(file.name));
  });
}

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("resolveContractLineNos", () => {
  it("returns every contract route belonging to a passenger service", () => {
    const lineMap = new Map([
      ["14", "14"],
      ["N14", "14"],
      ["N22", "N22"],
    ]);

    expect(resolveContractLineNos(lineMap, "14")).toEqual(["14", "N14"]);
  });

  it("keeps an explicitly named night service independent", () => {
    const lineMap = new Map([
      ["14", "14"],
      ["N14", "14"],
      ["N22", "N22"],
    ]);

    expect(resolveContractLineNos(lineMap, "N22")).toEqual(["N22"]);
  });

  it("falls back to the passenger route id when no mapping exists", () => {
    expect(resolveContractLineNos(new Map(), "X99")).toEqual(["X99"]);
  });
});

describe("buildRouteSchedules", () => {
  it("loads and merges every contract pattern archive for a passenger service", async () => {
    const outputRoot = await fs.mkdtemp(path.join(process.cwd(), "tmp-ibus-test-"));
    temporaryDirectories.push(outputRoot);
    const corpus = createSplitServiceCorpus();

    vi.mocked(fetchIbusZipCached).mockImplementation(async (_context, url) =>
      Buffer.from(url.includes("N14") ? "N14" : "14"),
    );
    mockPatternArchiveExtraction();

    const result = await buildRouteSchedules({
      baseVersion: "20250619",
      outputRoot,
      routeIds: ["14"],
      corpus,
      urls: {
        baseVersion: "20250619",
        downloadMethod: "direct-file-urls",
        baseVersionXml: "base-version.xml",
        vehicleZip: "vehicle.zip",
        garageZip: "garage.zip",
        lineZip: "line.zip",
        stopPointZip: "stops.zip",
        operatorScheduleZip: (operatorCode) => `${operatorCode}.zip`,
        patternDataZip: (contractLineNo) => `Pattern_data_${contractLineNo}.zip`,
      },
      context: {
        baseVersion: "20250619",
        stats: { cacheHits: 0, cacheMisses: 0, downloads: 0 },
        warnings: [],
      },
    });

    expect(vi.mocked(fetchIbusZipCached).mock.calls.map((call) => call[1])).toEqual([
      "Pattern_data_14.zip",
      "Pattern_data_N14.zip",
    ]);
    expect(result.routesBuilt).toEqual(["14"]);
  });

  it("skips a split service instead of publishing a partial schedule", async () => {
    const outputRoot = await fs.mkdtemp(path.join(process.cwd(), "tmp-ibus-test-"));
    temporaryDirectories.push(outputRoot);
    const existingSchedulePath = path.join(outputRoot, "route-schedules", "14.json");
    await fs.mkdir(path.dirname(existingSchedulePath), { recursive: true });
    await fs.writeFile(existingSchedulePath, "stale partial schedule", "utf8");
    vi.mocked(fetchIbusZipCached).mockImplementation(async (_context, url) =>
      url.includes("N14") ? null : Buffer.from("14"),
    );
    mockPatternArchiveExtraction();

    const result = await buildRouteSchedules({
      baseVersion: "20250619",
      outputRoot,
      routeIds: ["14"],
      corpus: createSplitServiceCorpus(),
      urls: {
        baseVersion: "20250619",
        downloadMethod: "direct-file-urls",
        baseVersionXml: "base-version.xml",
        vehicleZip: "vehicle.zip",
        garageZip: "garage.zip",
        lineZip: "line.zip",
        stopPointZip: "stops.zip",
        operatorScheduleZip: (operatorCode) => `${operatorCode}.zip`,
        patternDataZip: (contractLineNo) => `Pattern_data_${contractLineNo}.zip`,
      },
      context: {
        baseVersion: "20250619",
        stats: { cacheHits: 0, cacheMisses: 0, downloads: 0 },
        warnings: [],
      },
    });

    expect(result.routesBuilt).toEqual([]);
    expect(result.routesSkipped).toEqual(["14"]);
    expect(result.warnings).toContain(
      "Pattern data missing for route 14 contract N14; partial schedule not published",
    );
    await expect(fs.stat(existingSchedulePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("removes a stale schedule when the merged contracts contain no journeys", async () => {
    const outputRoot = await fs.mkdtemp(path.join(process.cwd(), "tmp-ibus-test-"));
    temporaryDirectories.push(outputRoot);
    const existingSchedulePath = path.join(outputRoot, "route-schedules", "14.json");
    await fs.mkdir(path.dirname(existingSchedulePath), { recursive: true });
    await fs.writeFile(existingSchedulePath, "stale partial schedule", "utf8");
    const corpus = createSplitServiceCorpus();
    corpus.journeysByPattern = new Map();
    vi.mocked(fetchIbusZipCached).mockImplementation(async (_context, url) =>
      Buffer.from(url.includes("N14") ? "N14" : "14"),
    );
    mockPatternArchiveExtraction();

    const result = await buildRouteSchedules({
      baseVersion: "20250619",
      outputRoot,
      routeIds: ["14"],
      corpus,
      urls: {
        baseVersion: "20250619",
        downloadMethod: "direct-file-urls",
        baseVersionXml: "base-version.xml",
        vehicleZip: "vehicle.zip",
        garageZip: "garage.zip",
        lineZip: "line.zip",
        stopPointZip: "stops.zip",
        operatorScheduleZip: (operatorCode) => `${operatorCode}.zip`,
        patternDataZip: (contractLineNo) => `Pattern_data_${contractLineNo}.zip`,
      },
      context: {
        baseVersion: "20250619",
        stats: { cacheHits: 0, cacheMisses: 0, downloads: 0 },
        warnings: [],
      },
    });

    expect(result.routesSkipped).toEqual(["14"]);
    await expect(fs.stat(existingSchedulePath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
