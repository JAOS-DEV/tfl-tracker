import { describe, expect, it } from "vitest";
import { getStatusPillClassName } from "@/components/StatusPill";

describe("StatusPill", () => {
  it("uses solid contrast classes for key variants", () => {
    expect(getStatusPillClassName("good")).toContain("bg-emerald-600");
    expect(getStatusPillClassName("warning")).toContain("bg-amber-500");
    expect(getStatusPillClassName("late")).toContain("bg-rose-600");
    expect(getStatusPillClassName("ghost")).toContain("bg-zinc-500");
    expect(getStatusPillClassName("live")).toContain("bg-emerald-600");
    expect(getStatusPillClassName("early")).toContain("bg-amber-500");
  });
});
