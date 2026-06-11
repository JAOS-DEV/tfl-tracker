import { describe, expect, it } from "vitest";
import {
  getMissingRouteIds,
  orderRoutesByUrl,
} from "@/lib/sharedRouteRestore";
import type { ActiveRoute } from "@/lib/tfl/types";

function route(routeId: string): ActiveRoute {
  return { routeId, routeName: routeId, addedAt: 1 };
}

describe("getMissingRouteIds", () => {
  it("returns route ids that are not already active", () => {
    expect(getMissingRouteIds(["337", "999"], [route("337")])).toEqual([
      "999",
    ]);
  });

  it("matches route ids case-insensitively", () => {
    expect(getMissingRouteIds(["N87"], [route("n87")])).toEqual([]);
  });
});

describe("orderRoutesByUrl", () => {
  it("orders restored routes to match the shared URL", () => {
    expect(
      orderRoutesByUrl(
        ["220", "337"],
        [route("337"), route("220")],
      ).map((item) => item.routeId),
    ).toEqual(["220", "337"]);
  });

  it("drops routes that are not present in the URL", () => {
    expect(
      orderRoutesByUrl(["337"], [route("337"), route("220")]).map(
        (item) => item.routeId,
      ),
    ).toEqual(["337"]);
  });
});
