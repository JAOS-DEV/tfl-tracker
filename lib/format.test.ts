import { describe, expect, it } from "vitest";
import { formatDueLabel, wrapStopLabel } from "@/lib/format";

describe("formatDueLabel", () => {
  it("formats due-now and minute labels", () => {
    expect(formatDueLabel(0)).toBe("Due");
    expect(formatDueLabel(60)).toBe("1 min");
    expect(formatDueLabel(180)).toBe("3 min");
  });
});

describe("wrapStopLabel", () => {
  it("returns a single line for short names", () => {
    expect(wrapStopLabel("Northcote Road", 20)).toEqual(["Northcote Road"]);
  });

  it("wraps long names onto a second line at word boundaries", () => {
    expect(
      wrapStopLabel("Larpool Avenue / Cottenham Park Road", 20),
    ).toEqual(["Larpool Avenue /", "Cottenham Park Road"]);
  });

  it("truncates with ellipsis when text still overflows the last line", () => {
    expect(
      wrapStopLabel(
        "Clapham Junction / Station / Falcon Road / Very Long Tail",
        18,
      ),
    ).toEqual([
      "Clapham Junction /",
      "Station / Falcon …",
    ]);
  });
});
