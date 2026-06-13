import { describe, expect, it, vi } from "vitest";
import {
  getCurrentBaseVersion,
  isHashStyleIbusUrl,
  isInvalidIbusFolderUrl,
  resolveIbusDownloadUrls,
  verifyDownloadMethod,
} from "@/lib/ibus/download";

describe("ibus download URLs", () => {
  it("parses Base_Version.xml via getCurrentBaseVersion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          `<Versioning_Of_Data><Base_Version>20260606</Base_Version></Versioning_Of_Data>`,
      })),
    );

    await expect(getCurrentBaseVersion()).resolves.toBe("20260606");
  });

  it("rejects direct folder URLs as invalid fetch targets", () => {
    expect(
      isInvalidIbusFolderUrl("https://ibus.data.tfl.gov.uk/Base_Version_20260606/"),
    ).toBe(true);
    expect(
      isInvalidIbusFolderUrl("https://ibus.data.tfl.gov.uk/Base_Version_20260606"),
    ).toBe(true);
  });

  it("rejects hash-style browser routes as invalid fetch targets", () => {
    expect(
      isInvalidIbusFolderUrl(
        "https://ibus.data.tfl.gov.uk/#!Base_Version_20260606%2F",
      ),
    ).toBe(true);
    expect(
      isHashStyleIbusUrl("https://ibus.data.tfl.gov.uk/#!Base_Version_20260606%2F"),
    ).toBe(true);
  });

  it("allows direct file URLs under the base version prefix", () => {
    const urls = resolveIbusDownloadUrls("20260606");

    expect(isInvalidIbusFolderUrl(urls.vehicleZip)).toBe(false);
    expect(urls.vehicleZip).toBe(
      "https://ibus.data.tfl.gov.uk/Base_Version_20260606/Vehicle_20260606.zip",
    );
    expect(urls.operatorScheduleZip("LG")).toBe(
      "https://ibus.data.tfl.gov.uk/Base_Version_20260606/LG/schedule_LG_20260606.zip",
    );
    expect(urls.patternDataZip("1234")).toBe(
      "https://ibus.data.tfl.gov.uk/Base_Version_20260606/Pattern_data_1234_20260606.zip",
    );
  });

  it("verifies folder listing fails while sample file succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: !url.endsWith("/Base_Version_20260606/"),
      })),
    );

    const result = await verifyDownloadMethod("20260606");

    expect(result.downloadMethod).toBe("direct-file-urls");
    expect(result.folderListingWorks).toBe(false);
    expect(result.sampleFileWorks).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("404"))).toBe(true);
  });
});
