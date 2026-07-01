import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AfterMidnightReplayBanner } from "@/components/AfterMidnightReplayBanner";

afterEach(cleanup);

describe("AfterMidnightReplayBanner", () => {
  it("shows the simulated London time and provenance", () => {
    render(
      <AfterMidnightReplayBanner
        scenario="0230"
        simulatedNow="2026-07-01T01:30:00.000Z"
        provenance="synthetic-known-sample"
      />,
    );

    expect(screen.getByText(/SIMULATED DATA/)).toBeInTheDocument();
    expect(screen.getByText(/02:30 London/)).toBeInTheDocument();
    expect(screen.getByText(/not a recorded TfL response/)).toBeInTheDocument();
  });

  it("does not claim the 02:30 overnight service has ended", () => {
    render(
      <AfterMidnightReplayBanner
        scenario="0230"
        simulatedNow="2026-07-01T01:30:00.000Z"
        provenance="synthetic-known-sample"
      />,
    );

    expect(
      screen.queryByText(/Route 14 has no scheduled service/i),
    ).not.toBeInTheDocument();
  });
});
