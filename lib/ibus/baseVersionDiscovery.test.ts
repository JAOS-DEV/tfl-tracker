import { describe, expect, it } from "vitest";
import {
  formatBaseVersionStatusLines,
  resolveBaseVersionSyncStatus,
} from "@/lib/ibus/baseVersionDiscovery";

describe("baseVersionDiscovery status summary", () => {
  it("marks matching TfL active and app current versions as up to date", () => {
    expect(
      resolveBaseVersionSyncStatus("20260717", "20260717", ["20260717"]),
    ).toBe("up-to-date");

    expect(
      formatBaseVersionStatusLines({
        activeBaseVersionFromXml: "20260717",
        appCurrentBaseVersion: "20260717",
        localImportedBaseVersions: ["20260717"],
      }),
    ).toEqual([
      "TfL active version (live predictions use this): 20260717",
      "App current version (what this project uses):   20260717",
      "Status: UP TO DATE — app is using the TfL active version",
    ]);
  });

  it("marks a mismatch as update needed", () => {
    expect(
      resolveBaseVersionSyncStatus("20260717", "20260703", ["20260703"]),
    ).toBe("update-needed");

    const lines = formatBaseVersionStatusLines({
      activeBaseVersionFromXml: "20260717",
      appCurrentBaseVersion: "20260703",
      localImportedBaseVersions: ["20260703"],
    });

    expect(lines[0]).toContain("20260717");
    expect(lines[1]).toContain("20260703");
    expect(lines[2]).toContain("UPDATE NEEDED");
    expect(lines[2]).toContain("npm run check:ibus");
  });

  it("handles unknown TfL active version", () => {
    expect(resolveBaseVersionSyncStatus(null, "20260717", ["20260717"])).toBe(
      "unknown",
    );
  });
});
