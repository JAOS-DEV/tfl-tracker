import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IbusDetailsSection } from "@/components/IbusDetailsSection";

describe("IbusDetailsSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("displays garage no, code, and name separately", () => {
    render(
      <IbusDetailsSection
        registration="LV24EWY"
        details={{
          ibusQuery: {
            isLoading: false,
            data: {
              registration: "LV24EWY",
              fleetNo: "3085",
              runningNo: "568",
              blockNo: "123568",
              garageNo: "123",
              garageCode: "QB",
              garageName: "Battersea",
              operatorCode: "CX",
              sourceBaseVersion: "20260606",
              fleetSource: "tfl-ibus-static",
              runningNumberSource: "tfl-ibus-static",
              status: "matched",
            },
          },
          fleetFallbackQuery: { isLoading: false, data: undefined },
          displayFleetNo: "3085",
          fleetSourceLabel: "TfL iBus static data",
          runningNo: "568",
          runningNumberSourceLabel: "TfL iBus static data",
        }}
      />,
    );

    expect(screen.getByText("Garage no")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText("Garage code")).toBeInTheDocument();
    expect(screen.getByText("QB")).toBeInTheDocument();
    expect(screen.getByText("Battersea")).toBeInTheDocument();
    expect(screen.getByText("123568")).toBeInTheDocument();
    expect(screen.getByText("568")).toBeInTheDocument();
  });

  it("shows a single source line when fleet and running share the same source", () => {
    render(
      <IbusDetailsSection
        registration="LV24EWY"
        details={{
          ibusQuery: {
            isLoading: false,
            data: {
              registration: "LV24EWY",
              fleetNo: "3085",
              runningNo: "568",
              fleetSource: "tfl-ibus-static",
              runningNumberSource: "tfl-ibus-static",
              status: "matched",
            },
          },
          fleetFallbackQuery: { isLoading: false, data: undefined },
          displayFleetNo: "3085",
          fleetSourceLabel: "TfL iBus static data",
          runningNo: "568",
          runningNumberSourceLabel: "TfL iBus static data",
        }}
      />,
    );

    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.queryByText("Fleet source")).not.toBeInTheDocument();
    expect(screen.queryByText("Running source")).not.toBeInTheDocument();
    expect(screen.getAllByText("TfL iBus static data")).toHaveLength(1);
  });

  it("shows unavailable wording when running number is missing", () => {
    render(
      <IbusDetailsSection
        registration="BT66MSU"
        details={{
          ibusQuery: {
            isLoading: false,
            data: {
              registration: "BT66MSU",
              fleetNo: "WHV142",
              fleetSource: "tfl-ibus-static",
              runningNumberSource: "none",
              status: "partial",
              message:
                "This live prediction does not include the trip/base-version data needed for running-number matching.",
            },
          },
          fleetFallbackQuery: { isLoading: false, data: undefined },
          displayFleetNo: "WHV142",
          fleetSourceLabel: "TfL iBus static data",
          runningNo: null,
          runningNumberSourceLabel: null,
        }}
      />,
    );

    expect(
      screen.getByText(
        "This live prediction does not include the trip/base-version data needed for running-number matching.",
      ),
    ).toBeInTheDocument();
  });
});
