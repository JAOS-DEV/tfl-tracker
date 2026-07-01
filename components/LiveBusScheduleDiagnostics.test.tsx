import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveBusScheduleDiagnostics } from "@/components/LiveBusScheduleDiagnostics";
import type { LiveBusScheduleDiagnostic } from "@/lib/schedulePipeline/types";

describe("LiveBusScheduleDiagnostics", () => {
  it("shows after-midnight candidate timing conversion details", () => {
    const diagnostic: LiveBusScheduleDiagnostic = {
      routeId: "14",
      vehicleId: "BUS112",
      vehicleRegistration: "BV66ZSD",
      positionKnown: true,
      candidateMatch: false,
      candidateMatchMethod: null,
      trustedTiming: false,
      rawDeviationMinutes: null,
      finalScheduleStatus: "unknown",
      finalAdherence: "unknown",
      unknownReason: "no-candidate-match",
      timingTrace: {
        journeyId: "373847",
        rawJourneyStartServiceTime: "24:18",
        rawJourneyEndServiceTime: "25:09",
        rawScheduledServiceTime: "25:14",
        staticServiceDayLondon: "2026-06-12",
        staticRolloverDays: 1,
        liveExpectedArrivalUtc: "2026-06-13T01:15:00.000Z",
        liveExpectedArrivalLondon: "13/06/2026, 02:15",
        scheduledArrivalUtc: "2026-06-13T00:14:00.000Z",
        scheduledArrivalLondon: "13/06/2026, 01:14",
        stopTimeDifferenceMinutes: 61,
        rejectionReason: "fallback-time-difference",
      },
    };

    render(
      <LiveBusScheduleDiagnostics
        diagnostics={[diagnostic]}
        part="details"
      />,
    );

    expect(screen.getByText("25:14")).toBeInTheDocument();
    expect(screen.getByText("2026-06-13T00:14:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("13/06/2026, 01:14")).toBeInTheDocument();
    expect(screen.getByText("fallback-time-difference")).toBeInTheDocument();
    expect(screen.getByText("2026-06-12")).toBeInTheDocument();
    expect(screen.getByText(/25:14 means 01:14 on the next London calendar day/)).toBeInTheDocument();
  });

  it("explains the raw live API clock calculation without a schedule candidate", () => {
    const diagnostic: LiveBusScheduleDiagnostic = {
      routeId: "14",
      vehicleId: "BUS117",
      positionKnown: true,
      candidateMatch: false,
      candidateMatchMethod: null,
      trustedTiming: false,
      rawDeviationMinutes: null,
      finalScheduleStatus: "unknown",
      finalAdherence: "unknown",
      unknownReason: "no-candidate-match",
      liveTimingAudit: {
        apiTimestampUtc: "2026-07-01T01:30:00.000Z",
        timeToStationSeconds: 120,
        expectedArrivalUtc: "2026-07-01T01:32:05.000Z",
        timestampPlusTimeToStationUtc: "2026-07-01T01:32:00.000Z",
        consistencyDifferenceSeconds: 5,
      },
    };

    render(<LiveBusScheduleDiagnostics diagnostics={[diagnostic]} part="details" />);

    expect(screen.getByText("Live API clock check")).toBeInTheDocument();
    expect(
      screen.getByText("1 Jul 2026, 02:30:00 London (01:30:00 UTC)"),
    ).toBeInTheDocument();
    expect(screen.getByText("5 sec")).toBeInTheDocument();
  });
});
