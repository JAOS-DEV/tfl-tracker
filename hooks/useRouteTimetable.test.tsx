import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRouteTimetable } from "@/hooks/useRouteTimetable";
import type { NormalizedRoute } from "@/lib/tfl/types";

const route: NormalizedRoute = {
  routeId: "337",
  routeName: "337",
  outbound: [
    {
      id: "outbound-stop",
      name: "Outbound Stop",
      naptanId: "490000001A",
      isTimingPoint: false,
    },
  ],
  inbound: [
    {
      id: "inbound-stop",
      name: "Inbound Stop",
      naptanId: "490000002B",
      isTimingPoint: false,
    },
  ],
};

function renderWithClient(element: ReactElement): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  return client;
}

function TimetableConsumer({
  enabled,
}: {
  enabled: boolean;
}): ReactElement {
  useRouteTimetable("337", route, enabled);
  return <div>consumer</div>;
}

describe("useRouteTimetable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call the timetable endpoint when disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient(<TimetableConsumer enabled={false} />);

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("dedupes duplicate timetable consumers for the same route directions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routeId: "337",
        direction: "outbound",
        fromStopPointId: "490000001A",
        available: true,
        journeys: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient(
      <>
        <TimetableConsumer enabled />
        <TimetableConsumer enabled />
      </>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(
      fetchMock.mock.calls.every((call) =>
        String(call[0]).startsWith("/api/tfl/timetable?"),
      ),
    ).toBe(true);
  });
});
