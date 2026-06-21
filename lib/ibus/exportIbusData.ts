import fs from "node:fs/promises";
import path from "node:path";
import { getIbusDataRoot } from "@/lib/ibus/baseVersionDiscovery";
import { computeDirectorySize, formatBytes } from "@/lib/ibus/importSingleVersion";

const DEFAULT_OUTPUT_ROOT = path.join("dist", "ibus-data", "data", "ibus");

async function copyDirectory(source: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, destinationPath);
    }
  }
}

async function countFiles(dirPath: string): Promise<number> {
  let count = 0;

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        count += 1;
      }
    }
  }

  await walk(dirPath);
  return count;
}

export interface ExportIbusDataResult {
  sourceRoot: string;
  outputRoot: string;
  fileCount: number;
  totalBytes: number;
}

export async function exportIbusData(
  outputRoot = process.env.IBUS_EXPORT_DIR?.trim() || DEFAULT_OUTPUT_ROOT,
): Promise<ExportIbusDataResult> {
  const sourceRoot = getIbusDataRoot();

  try {
    await fs.access(path.join(sourceRoot, "current.json"));
  } catch {
    throw new Error(
      `No iBus data found at ${sourceRoot}. Run import:ibus or import:ibus:versions first.`,
    );
  }

  await fs.rm(outputRoot, { recursive: true, force: true });
  await copyDirectory(sourceRoot, outputRoot);

  const totalBytes = await computeDirectorySize(outputRoot);
  const fileCount = await countFiles(outputRoot);

  return {
    sourceRoot,
    outputRoot,
    fileCount,
    totalBytes,
  };
}

export function getDefaultIbusExportRoot(): string {
  return DEFAULT_OUTPUT_ROOT;
}

export async function main(): Promise<void> {
  const result = await exportIbusData();

  console.log("");
  console.log("iBus static data export complete");
  console.log(`Source: ${result.sourceRoot}`);
  console.log(`Output: ${result.outputRoot}`);
  console.log(`Files: ${result.fileCount}`);
  console.log(`Total size: ${formatBytes(result.totalBytes)}`);
  console.log("");
  console.log("Upload the contents preserving paths, e.g.:");
  console.log(`  ${result.outputRoot}/current.json`);
  console.log(`  ${result.outputRoot}/20250619/...`);
  console.log("");
  console.log("Then set:");
  console.log("  NEXT_PUBLIC_IBUS_DATA_BASE_URL=https://your-static-host.example.com/data/ibus");
}
