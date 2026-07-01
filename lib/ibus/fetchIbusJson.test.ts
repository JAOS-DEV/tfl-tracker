import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchIbusJson } from "@/lib/ibus/fetchIbusJson";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchIbusJson cache policy", () => {
  it("revalidates route schedules so regenerated data is not hidden by browser cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ schemaVersion: 2 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchIbusJson("20250619/route-schedules/14.json", {
      trackAs: "routeSchedule",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/data/ibus/20250619/route-schedules/14.json",
      { cache: "no-cache" },
    );
  });
});
