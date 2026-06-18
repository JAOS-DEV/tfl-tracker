import { describe, expect, it } from "vitest";
import {
  buildDirectionStopRowKeys,
  buildStopRowKey,
  hasUniqueKeys,
} from "@/lib/listRowKeys";

describe("listRowKeys", () => {
  it("keeps keys unique when the same stop id appears in both directions", () => {
    const sharedStop = { id: "759209907" };
    const outboundKeys = buildDirectionStopRowKeys("14", "outbound", [
      sharedStop,
      { id: "stop-2" },
    ]);
    const inboundKeys = buildDirectionStopRowKeys("14", "inbound", [
      sharedStop,
      { id: "stop-3" },
    ]);

    expect(hasUniqueKeys(outboundKeys)).toBe(true);
    expect(hasUniqueKeys(inboundKeys)).toBe(true);
    expect(hasUniqueKeys([...outboundKeys, ...inboundKeys])).toBe(true);
    expect(outboundKeys[0]).toBe("14:outbound:759209907:0");
    expect(inboundKeys[0]).toBe("14:inbound:759209907:0");
  });

  it("keeps keys unique when the same stop id repeats in one direction", () => {
    const keys = buildDirectionStopRowKeys("337", "outbound", [
      { id: "759209907" },
      { id: "759209907" },
      { id: "stop-3" },
    ]);

    expect(keys).toEqual([
      "337:outbound:759209907:0",
      "337:outbound:759209907:1",
      "337:outbound:stop-3:2",
    ]);
    expect(hasUniqueKeys(keys)).toBe(true);
  });

  it("builds stable composite keys from route, direction, stop id, and index", () => {
    expect(buildStopRowKey("14", "inbound", "759209907", 4)).toBe(
      "14:inbound:759209907:4",
    );
  });
});
