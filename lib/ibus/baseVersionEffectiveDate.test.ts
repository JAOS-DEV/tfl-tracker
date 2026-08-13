import { describe, expect, it } from "vitest";
import {
  compareLabelledDateToToday,
  describeBaseVersionEffectiveDate,
  formatEffectiveDateRelation,
  parseBaseVersionLabelledDate,
} from "@/lib/ibus/baseVersionEffectiveDate";

describe("parseBaseVersionLabelledDate", () => {
  it("parses YYYYMMDD version ids", () => {
    expect(parseBaseVersionLabelledDate("20260815")).toBe("2026-08-15");
  });

  it("rejects impossible calendar dates", () => {
    expect(parseBaseVersionLabelledDate("20260231")).toBeNull();
  });
});

describe("compareLabelledDateToToday", () => {
  it("classifies past, today, and future vs London today", () => {
    expect(compareLabelledDateToToday("2026-07-31", "2026-08-13")).toBe("past");
    expect(compareLabelledDateToToday("2026-08-13", "2026-08-13")).toBe("today");
    expect(compareLabelledDateToToday("2026-08-16", "2026-08-13")).toBe(
      "future",
    );
  });
});

describe("formatEffectiveDateRelation", () => {
  it("explains future-dated packs", () => {
    const info = describeBaseVersionEffectiveDate("20260816", "2026-08-13");
    expect(formatEffectiveDateRelation(info)).toMatch(/still in the future/i);
  });
});
