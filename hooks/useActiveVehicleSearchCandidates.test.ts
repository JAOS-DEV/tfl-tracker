import { describe, expect, it, vi } from "vitest";
import { subscribeToQueryCacheDeferred } from "@/hooks/useActiveVehicleSearchCandidates";

describe("subscribeToQueryCacheDeferred", () => {
  it("notifies after the current render stack and coalesces cache events", async () => {
    vi.useFakeTimers();
    let notifyCache!: () => void;
    const unsubscribe = vi.fn();
    const onStoreChange = vi.fn();
    const subscribe = vi.fn((listener: () => void) => {
      notifyCache = listener;
      return unsubscribe;
    });

    const cleanup = subscribeToQueryCacheDeferred(subscribe, onStoreChange);
    notifyCache();
    notifyCache();

    expect(onStoreChange).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(onStoreChange).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(onStoreChange).toHaveBeenCalledTimes(1);

    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not notify after the subscription is cleaned up", async () => {
    vi.useFakeTimers();
    let notifyCache!: () => void;
    const onStoreChange = vi.fn();
    const cleanup = subscribeToQueryCacheDeferred((listener) => {
      notifyCache = listener;
      return vi.fn();
    }, onStoreChange);

    notifyCache();
    cleanup();
    await Promise.resolve();
    vi.runAllTimers();

    expect(onStoreChange).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
