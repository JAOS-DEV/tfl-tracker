import fs from "node:fs/promises";
import path from "node:path";
import { rebuildMultiVersionManifestFromDisk } from "../lib/ibus/multiVersionManifest";
import { fetchActiveBaseVersionFromXml } from "../lib/ibus/baseVersionDiscovery";

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const activeBaseVersionFromXml = await fetchActiveBaseVersionFromXml().catch(
    () => "20260606",
  );
  const manifest = await rebuildMultiVersionManifestFromDisk(
    activeBaseVersionFromXml,
  );
  await writeJson(
    path.join("public", "data", "ibus", "current.json"),
    manifest,
  );
  console.log(
    `Rebuilt manifest with ${manifest.availableBaseVersions?.length ?? 0} local version(s).`,
  );
  console.log(`Active baseVersion from XML: ${manifest.activeBaseVersionFromXml}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
