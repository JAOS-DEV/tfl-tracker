import fs from "node:fs/promises";
import path from "node:path";
import { rebuildMultiVersionManifestFromDisk } from "../lib/ibus/multiVersionManifest";
import { fetchActiveBaseVersionFromXml } from "../lib/ibus/baseVersionDiscovery";
import {
  printNextStep,
  printWorkflowBlock,
} from "../lib/ibus/baseVersionWorkflow";

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

  printWorkflowBlock({
    title: "iBus manifest rebuilt",
    lines: [
      `  Local version(s): ${manifest.availableBaseVersions?.join(", ") ?? "none"}`,
      `  App current:      ${manifest.baseVersion}`,
      `  TfL active XML:   ${manifest.activeBaseVersionFromXml}`,
    ],
  });

  printNextStep({
    command: "npm run verify:ibus-local",
    note: "Confirms the selected base version is healthy before you open a PR.",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
