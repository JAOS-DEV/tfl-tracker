import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteCardActionBar } from "@/components/RouteCardActionBar";

describe("RouteCardActionBar", () => {
  it("renders core actions without route info", () => {
    render(
      <RouteCardActionBar
        onServiceDetails={vi.fn()}
        onHistory={vi.fn()}
        onAlerts={vi.fn()}
        historySummary="12 today"
      />,
    );

    expect(screen.getByRole("button", { name: "Service details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History · 12 today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alerts" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Route info" })).not.toBeInTheDocument();
  });

  it("calls action handlers", async () => {
    cleanup();
    const user = userEvent.setup();
    const onServiceDetails = vi.fn();
    const onHistory = vi.fn();
    const onAlerts = vi.fn();

    render(
      <RouteCardActionBar
        onServiceDetails={onServiceDetails}
        onHistory={onHistory}
        onAlerts={onAlerts}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Service details" }));
    await user.click(screen.getByRole("button", { name: "History" }));
    await user.click(screen.getByRole("button", { name: "Alerts" }));

    expect(onServiceDetails).toHaveBeenCalledOnce();
    expect(onHistory).toHaveBeenCalledOnce();
    expect(onAlerts).toHaveBeenCalledOnce();
  });
});
