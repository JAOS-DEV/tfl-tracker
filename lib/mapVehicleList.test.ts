import { describe, expect, it } from "vitest";
import {
  buildMapVehicleAriaLabel,
  formatMapVehicleBadgeLabel,
  formatMapVehiclePrimaryLine,
  formatMapVehicleStatusLine,
  getMapVehicleTone,
} from "@/lib/mapVehicleList";
import type { EstimatedVehiclePosition } from "@/lib/tfl/types";

function vehicle(
  overrides: Partial<EstimatedVehiclePosition> = {},
): EstimatedVehiclePosition {
  return {
    vehicleId: "337-562",
    routeNumber: "337",
    direction: "outbound",
    progress: 0.4,
    adherence: "onTime",
    markerState: "live",
    ghostStatus: "none",
    matched: true,
    missedRefreshCount: 0,
    scheduleStatus: "onTime",
    scheduleStatusLabel: "On time",
    scheduleDeviationMinutes: 0,
    scheduleMatchConfidence: "high",
    destinationName: "Richmond Bus Station",
    vehicleRegistration: "LV24EUH",
    ibusFleetNo: "3049",
    ibusRunningNo: "562",
    nextStop: { name: "Northcote Road", naptanId: "490000001A" },
    ...overrides,
  } as EstimatedVehiclePosition;
}

describe("mapVehicleList", () => {
  it("formats a full identity primary line without repeating the route number", () => {
    const line = formatMapVehiclePrimaryLine(vehicle());

    expect(line).toBe("Run 562 · LV24EUH · Fleet 3049");
    expect(line).not.toContain("Bus 337");
    expect(line).not.toMatch(/\b337\b/);
  });

  it("omits missing registration and fleet cleanly", () => {
    expect(
      formatMapVehiclePrimaryLine(
        vehicle({
          vehicleRegistration: undefined,
          ibusFleetNo: undefined,
          vehicleFleetReference: undefined,
        }),
      ),
    ).toBe("Run 562");

    expect(
      formatMapVehiclePrimaryLine(
        vehicle({
          ibusRunningNo: undefined,
          scheduledGhostRunningNo: undefined,
          vehicleRegistration: "LV24EUK",
          ibusFleetNo: "3051",
        }),
      ),
    ).toBe("LV24EUK · Fleet 3051");

    expect(
      formatMapVehiclePrimaryLine(
        vehicle({
          ibusRunningNo: undefined,
          vehicleRegistration: undefined,
          ibusFleetNo: undefined,
          vehicleFleetReference: undefined,
        }),
      ),
    ).toBe("Live bus");
  });

  it("formats late, early, on-time, and unknown labels", () => {
    expect(formatMapVehicleBadgeLabel(vehicle())).toBe("On time");
    expect(
      formatMapVehicleBadgeLabel(
        vehicle({
          scheduleStatus: "late",
          scheduleDeviationMinutes: 2,
          adherence: "late",
          scheduleStatusLabel: "+2 late",
        }),
      ),
    ).toBe("Late +2");
    expect(
      formatMapVehicleBadgeLabel(
        vehicle({
          scheduleStatus: "early",
          scheduleDeviationMinutes: -4,
          adherence: "early",
          scheduleStatusLabel: "-4 early",
        }),
      ),
    ).toBe("Early -4");
    expect(
      formatMapVehicleBadgeLabel(
        vehicle({
          scheduleStatus: "unknown",
          scheduleDeviationMinutes: null,
          adherence: "unknown",
          scheduleStatusLabel: "Schedule ?",
        }),
      ),
    ).toBe("Unknown");

    expect(
      formatMapVehicleStatusLine(
        vehicle({
          scheduleStatus: "late",
          scheduleDeviationMinutes: 2,
          scheduleStatusLabel: "+2 late",
          nextStop: {
            id: "1",
            name: "Kings Road",
            naptanId: "1",
            isTimingPoint: false,
          },
        }),
      ),
    ).toBe("+2 late · near Kings Road");

    expect(
      formatMapVehicleStatusLine(
        vehicle({
          scheduleStatus: "unknown",
          scheduleDeviationMinutes: null,
          scheduleStatusLabel: "Schedule ?",
          nextStop: {
            id: "1",
            name: "Northcote Road",
            naptanId: "1",
            isTimingPoint: false,
          },
        }),
      ),
    ).toBe("Unknown timing · near Northcote Road");
  });

  it("formats ghost bus wording", () => {
    const ghost = vehicle({
      vehicleId: "ghost-563",
      isScheduledGhostCandidate: true,
      scheduledGhostRunningNo: "563",
      ghostReason: "Scheduled but no matching live bus",
      vehicleRegistration: undefined,
      ibusFleetNo: undefined,
      ibusRunningNo: undefined,
    });

    expect(formatMapVehiclePrimaryLine(ghost)).toBe("Possible ghost · Run 563");
    expect(formatMapVehicleStatusLine(ghost)).toBe(
      "Scheduled but no matching live bus",
    );
    expect(formatMapVehicleBadgeLabel(ghost)).toBe("Ghost");
    expect(getMapVehicleTone(ghost)).toBe("ghost");
  });

  it("formats layover and stale wording with matching tones", () => {
    const layover = vehicle({
      markerState: "terminus-layover",
      terminusLayoverLabel: "At terminus",
      adherence: "unknown",
    });
    expect(formatMapVehicleBadgeLabel(layover)).toBe("Layover");
    expect(formatMapVehicleStatusLine(layover)).toContain("At terminus");
    expect(getMapVehicleTone(layover)).toBe("layover");

    const stale = vehicle({
      ghostStatus: "missingLatest",
      predictionConfidence: "stale",
      adherence: "onTime",
    });
    expect(formatMapVehicleBadgeLabel(stale)).toBe("Stale");
    expect(getMapVehicleTone(stale)).toBe("stale");
  });

  it("maps tones to marker adherence colours", () => {
    expect(getMapVehicleTone(vehicle({ adherence: "onTime" }))).toBe("onTime");
    expect(getMapVehicleTone(vehicle({ adherence: "late" }))).toBe("late");
    expect(getMapVehicleTone(vehicle({ adherence: "early" }))).toBe("early");
    expect(getMapVehicleTone(vehicle({ adherence: "unknown" }))).toBe(
      "unknown",
    );
  });

  it("builds an aria-label with useful vehicle details", () => {
    const label = buildMapVehicleAriaLabel(
      vehicle({
        scheduleStatus: "late",
        scheduleDeviationMinutes: 2,
        adherence: "late",
        nextStop: {
          id: "1",
          name: "Kings Road",
          naptanId: "1",
          isTimingPoint: false,
        },
      }),
    );

    expect(label).toContain("Run 562");
    expect(label).toContain("LV24EUH");
    expect(label).toContain("fleet 3049");
    expect(label).toContain("late by 2 minutes");
    expect(label).toContain("near Kings Road");
    expect(label).not.toContain("Bus 337");
  });
});
