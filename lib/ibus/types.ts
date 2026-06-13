export interface IbusVehicleRecord {
  fleetNo: string;
  bonnetNo: string;
  operatorAgency: string | null;
  baseVersion: string;
  source: "tfl-ibus-static";
}

export interface IbusGarageRecord {
  garageNo: string;
  garageCode: string | null;
  garageName: string | null;
  operatorCode: string | null;
  source: "tfl-ibus-static";
}

export interface IbusRunningRecord {
  runningNo: string;
  blockNo: string;
  blockIdx: string;
  garageNo: string | null;
  operatorCode: string | null;
  source: "tfl-ibus-static";
}

export interface IbusCurrentManifest {
  baseVersion: string;
  generatedAt: string;
  runningShardPathTemplate: string;
  routeSchedulePathTemplate?: string;
  routeScheduleRoutes?: string[];
  garageLookupPath: string;
  vehicleLookupPath: string;
  importReportPath: string;
  counts: {
    runningNumbers: number;
    garages: number;
    vehicles: number;
    operators: number;
    warnings: number;
  };
}

export interface IbusImportReport {
  baseVersion: string;
  generatedAt: string;
  downloadMethod: "direct-file-urls";
  cacheUsed: boolean;
  forceDownload: boolean;
  operatorFoldersDetected: string[];
  scheduleZipsDownloaded: string[];
  scheduleZipsReusedFromCache: string[];
  scheduleZipsSkipped: string[];
  journeyRecordsParsed: number;
  blockRecordsParsed: number;
  waitRecordsParsed: number;
  driveRecordsParsed: number;
  stopRecordsParsed: number;
  patternRecordsParsed: number;
  runningNumberRecordsGenerated: number;
  garageRecordsGenerated: number;
  vehicleRecordsGenerated: number;
  shardCount: number;
  routeSchedulesRequested: string | null;
  routeSchedulesGenerated: number;
  routeSchedulesSkipped: number;
  routeScheduleRoutes: string[];
  routeScheduleSchemaVersion: number;
  compactScheduleEnabled: boolean;
  totalRouteScheduleSizeBytes: number;
  totalLegacyRouteScheduleSizeBytes: number;
  averageRouteScheduleSizeBytes: number;
  largestRouteSchedule: { routeId: string; sizeBytes: number } | null;
  topLargestRouteSchedules: Array<{ routeId: string; sizeBytes: number }>;
  estimatedCompactSavingsBytes: number;
  totalOutputSizeBytes: number;
  fileSizes: Record<string, number>;
  warnings: string[];
}

export type IbusLookupStatus =
  | "matched"
  | "partial"
  | "missing-live-trip"
  | "missing-static-data"
  | "base-version-mismatch"
  | "not-found"
  | "error";

export interface IbusPredictionInput {
  tripId?: string;
  baseVersion?: string;
  vehicleId?: string;
  lineName?: string;
  expectedArrival?: string;
  naptanId?: string;
  destinationName?: string;
}

export interface IbusDetailsResult {
  registration?: string;
  fleetNo?: string;
  bonnetNo?: string;
  runningNo?: string;
  blockNo?: string;
  blockIdx?: string;
  garageNo?: string;
  garageCode?: string;
  garageName?: string;
  operatorCode?: string;
  operatorAgency?: string;
  sourceBaseVersion?: string;
  fleetSource?: "tfl-ibus-static" | "bustimes" | "none";
  runningNumberSource?: "tfl-ibus-static" | "none";
  status: IbusLookupStatus;
  message?: string;
}
