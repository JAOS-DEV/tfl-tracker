import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RouteLoopStopNode } from "@/components/RouteLoopStopNode";
import type { LoopStopNode } from "@/lib/tfl/types";

const node: LoopStopNode = {
  stop: {
    id: "759209907",
    name: "Shared Stop",
    naptanId: "759209907",
    isTimingPoint: false,
  },
  direction: "outbound",
  index: 1,
  progress: 0.4,
  isTerminal: false,
  shouldLabel: true,
};

describe("RouteLoopStopNode", () => {
  it("uses normal stop styling when timing metadata is absent", () => {
    const { container } = render(
      <svg>
        <RouteLoopStopNode
          node={node}
          x={100}
          y={100}
          isSelected={false}
          hasNearbyBus={false}
          isClosed={false}
          isTimingPoint={false}
          compact={false}
          orientation="landscape"
          onSelect={() => undefined}
        />
      </svg>,
    );

    expect(container.innerHTML).toContain("fill-zinc-400");
    expect(container.innerHTML).not.toContain("fill-amber-300");
  });

  it("uses timing-point styling only when isTimingPoint is true", () => {
    const { container } = render(
      <svg>
        <RouteLoopStopNode
          node={{
            ...node,
            stop: {
              ...node.stop,
              isTimingPoint: true,
              timingPointSource: "ibus-timing-point",
            },
          }}
          x={100}
          y={100}
          isSelected={false}
          hasNearbyBus={false}
          isClosed={false}
          isTimingPoint
          compact={false}
          orientation="landscape"
          onSelect={() => undefined}
        />
      </svg>,
    );

    expect(container.innerHTML).toContain("fill-amber-300");
  });
});
