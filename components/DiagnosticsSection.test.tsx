import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DiagnosticsPanelGroup, DiagnosticsSection } from "@/components/DiagnosticsSection";

describe("DiagnosticsSection", () => {
  it("is collapsed by default and expands on click", async () => {
    const user = userEvent.setup();

    render(
      <DiagnosticsSection title="Test diagnostics" summary="3 items">
        <p>Hidden diagnostic body</p>
      </DiagnosticsSection>,
    );

    expect(screen.queryByText("Hidden diagnostic body")).not.toBeInTheDocument();
    expect(screen.getByText("Test diagnostics")).toBeInTheDocument();
    expect(screen.getByText("3 items")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Test diagnostics/i }));

    expect(screen.getByText("Hidden diagnostic body")).toBeInTheDocument();
  });

  it("supports expand all in panel group", async () => {
    const user = userEvent.setup();

    render(
      <DiagnosticsPanelGroup>
        <DiagnosticsSection title="Section A" summary="A">
          <p>Body A</p>
        </DiagnosticsSection>
        <DiagnosticsSection title="Section B" summary="B">
          <p>Body B</p>
        </DiagnosticsSection>
      </DiagnosticsPanelGroup>,
    );

    await user.click(screen.getByRole("button", { name: "Expand all" }));

    expect(screen.getByText("Body A")).toBeInTheDocument();
    expect(screen.getByText("Body B")).toBeInTheDocument();
  });
});
