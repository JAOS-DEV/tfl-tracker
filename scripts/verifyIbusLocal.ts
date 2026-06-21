import { verifyLocalIbusData } from "../lib/ibus/verifyLocalIbusData";

async function main(): Promise<void> {
  console.log("Verifying local iBus static data...");
  const result = await verifyLocalIbusData();

  console.log("");
  console.log("=== Local iBus verification ===");
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(
    `Active baseVersion (Base_Version.xml): ${result.activeBaseVersionFromXml ?? "unknown"}`,
  );
  console.log(
    `Manifest activeBaseVersionFromXml: ${result.manifestActiveBaseVersion ?? "unknown"}`,
  );
  console.log(`Local baseVersion folders: ${result.localBaseVersions.join(", ") || "none"}`);
  console.log(
    `Active version route count: ${result.activeVersionRouteCount ?? "unknown"}`,
  );
  console.log(
    `Remote data URL configured: ${result.remoteDataBaseUrlConfigured ? "yes" : "no"}`,
  );

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log("Local iBus data looks ready for deployment.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
