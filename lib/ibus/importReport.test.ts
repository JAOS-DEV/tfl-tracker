import { describe, expect, it } from "vitest";
import type { IbusImportReport } from "@/lib/ibus/types";

describe("ibus import report shape", () => {
  it("includes compact schedule size fields", () => {
    const report: IbusImportReport = {
      baseVersion: "20260606",
      generatedAt: "2026-06-13T00:00:00.000Z",
      downloadMethod: "direct-file-urls",
      cacheUsed: true,
      forceDownload: false,
      operatorFoldersDetected: ["LG"],
      scheduleZipsDownloaded: ["LG"],
      scheduleZipsReusedFromCache: [],
      scheduleZipsSkipped: [],
      journeyRecordsParsed: 1,
      blockRecordsParsed: 1,
      waitRecordsParsed: 1,
      driveRecordsParsed: 1,
      stopRecordsParsed: 1,
      patternRecordsParsed: 1,
      runningNumberRecordsGenerated: 1,
      garageRecordsGenerated: 1,
      vehicleRecordsGenerated: 1,
      shardCount: 256,
      routeSchedulesRequested: "337,156",
      routeSchedulesGenerated: 2,
      routeSchedulesSkipped: 0,
      routeScheduleRoutes: ["156", "337"],
      routeScheduleSchemaVersion: 2,
      compactScheduleEnabled: true,
      totalRouteScheduleSizeBytes: 1024,
      totalLegacyRouteScheduleSizeBytes: 4096,
      averageRouteScheduleSizeBytes: 512,
      largestRouteSchedule: { routeId: "337", sizeBytes: 700 },
      topLargestRouteSchedules: [{ routeId: "337", sizeBytes: 700 }],
      estimatedCompactSavingsBytes: 3072,
      totalOutputSizeBytes: 2048,
      fileSizes: {},
      warnings: [],
    };

    expect(report.routeScheduleSchemaVersion).toBe(2);
    expect(report.compactScheduleEnabled).toBe(true);
    expect(report.estimatedCompactSavingsBytes).toBe(3072);
    expect(report.topLargestRouteSchedules[0]?.routeId).toBe("337");
  });
});
