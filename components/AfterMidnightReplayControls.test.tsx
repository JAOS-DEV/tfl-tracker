import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AfterMidnightReplayControls } from "@/components/AfterMidnightReplayControls";

afterEach(cleanup);

describe("AfterMidnightReplayControls", () => {
  it("offers fixed London after-midnight scenarios", () => {
    render(<AfterMidnightReplayControls activeScenario={null} onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Simulate 00:15" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulate 00:45" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulate 01:15" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulate 01:30" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulate 02:30" })).toBeInTheDocument();
  });

  it("selects a scenario and clearly identifies synthetic data", async () => {
    const onSelect = vi.fn();
    render(<AfterMidnightReplayControls activeScenario={null} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "Simulate 01:15" }));

    expect(onSelect).toHaveBeenCalledWith("0115");
    expect(screen.getByText(/synthetic reconstruction/i)).toBeInTheDocument();
  });

  it("offers an exit action while replay is active", async () => {
    const onSelect = vi.fn();
    render(<AfterMidnightReplayControls activeScenario="0230" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "Exit simulation" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
