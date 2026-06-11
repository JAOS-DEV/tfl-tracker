import { describe, expect, it } from "vitest";
import { formatFriendlyError } from "@/lib/errors";

describe("formatFriendlyError", () => {
  it("formats offline errors", () => {
    const friendly = formatFriendlyError(null, { isOffline: true });
    expect(friendly.kind).toBe("network-offline");
    expect(friendly.title).toMatch(/offline/i);
  });

  it("formats invalid shared route URLs", () => {
    const friendly = formatFriendlyError(null, {
      invalidRouteIds: ["999", "abc"],
    });
    expect(friendly.kind).toBe("invalid-shared-url");
    expect(friendly.title).toMatch(/shared link could not be loaded/i);
    expect(friendly.message).toContain("999");
    expect(friendly.message).toContain("abc");
  });

  it("formats missing API key errors", () => {
    const friendly = formatFriendlyError(
      new Error("Server configuration error: TFL_API_KEY is missing or invalid"),
    );
    expect(friendly.kind).toBe("missing-api-key");
    expect(friendly.action).toMatch(/\.env\.local/i);
  });

  it("formats route not found errors", () => {
    const friendly = formatFriendlyError(
      new Error('No bus route found for "999".'),
    );
    expect(friendly.kind).toBe("route-not-found");
  });

  it("formats rate limit errors", () => {
    const friendly = formatFriendlyError(new Error("429 Too many requests"));
    expect(friendly.kind).toBe("rate-limit");
  });

  it("formats network fetch failures", () => {
    const friendly = formatFriendlyError(new Error("Failed to fetch"));
    expect(friendly.kind).toBe("network-offline");
  });
});
