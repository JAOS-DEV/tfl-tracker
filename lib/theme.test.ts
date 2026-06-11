import { describe, expect, it } from "vitest";
import { readThemePreference, resolveIsDark } from "@/lib/theme";

describe("theme", () => {
  it("resolves dark mode from preference", () => {
    expect(resolveIsDark("dark", false)).toBe(true);
    expect(resolveIsDark("light", true)).toBe(false);
    expect(resolveIsDark("system", true)).toBe(true);
    expect(resolveIsDark("system", false)).toBe(false);
  });

  it("reads stored theme preference from localStorage json", () => {
    expect(readThemePreference(JSON.stringify("dark"))).toBe("dark");
    expect(readThemePreference(JSON.stringify("light"))).toBe("light");
    expect(readThemePreference(null)).toBe("system");
    expect(readThemePreference("invalid")).toBe("system");
  });
});
