import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StopRow } from "@/components/StopRow";
import type { NormalizedStop } from "@/lib/tfl/types";

const baseStop: NormalizedStop = {
  id: "759209907",
  name: "Shared Stop",
  naptanId: "759209907",
  isTimingPoint: false,
  isQsiPoint: false,
};

describe("StopRow", () => {
  it("uses normal styling when timing metadata is absent", () => {
    const { container } = render(
      <StopRow
        rowKey="14:outbound:759209907:0"
        stop={baseStop}
        predictions={[]}
        isFirst
        isLast={false}
        showTimingPoints
        onSelect={() => undefined}
      />,
    );

    expect(screen.queryByText("Timing point")).not.toBeInTheDocument();
    expect(screen.queryByText("QSI point")).not.toBeInTheDocument();
    expect(container.innerHTML).toContain("border-zinc-400");
    expect(container.innerHTML).not.toContain("border-amber-500");
  });

  it("shows timing point chip only when isTimingPoint is true", () => {
    render(
      <StopRow
        rowKey="14:outbound:759209907:0"
        stop={{
          ...baseStop,
          isTimingPoint: true,
          timingPointSource: "ibus-timing-point",
        }}
        predictions={[]}
        isFirst
        isLast={false}
        showTimingPoints
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("Timing point")).toBeInTheDocument();
  });

  it("shows QSI chip only when isQsiPoint is true", () => {
    render(
      <StopRow
        rowKey="14:outbound:759209907:0"
        stop={{
          ...baseStop,
          isTimingPoint: true,
          isQsiPoint: true,
          timingPointSource: "qsi-import",
        }}
        predictions={[]}
        isFirst
        isLast={false}
        showTimingPoints
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText("QSI point")).toBeInTheDocument();
  });
});
