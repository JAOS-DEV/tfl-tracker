import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "@/components/SettingsPanel";
import { DEFAULT_DISPLAY_SETTINGS } from "@/lib/displaySettings";
import { STORAGE_KEYS } from "@/lib/storage";

describe("SettingsPanel", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.body.style.touchAction = "";
    document.body.style.paddingRight = "";
  });

  it("renders Settings header and close button in the sheet header", () => {
    const onClose = vi.fn();
    render(<SettingsPanel isOpen onClose={onClose} />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const closeButton = screen.getByRole("button", { name: "Close settings" });
    expect(closeButton.closest("header")).not.toBeNull();

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Map/Loop/List default view control and Map as the fresh default", () => {
    render(<SettingsPanel isOpen onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Map" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Loop" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Loop" }));
    expect(screen.getByRole("button", { name: "Loop" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("restores Map as default view after reset app to defaults", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.displaySettings,
      JSON.stringify({
        ...DEFAULT_DISPLAY_SETTINGS,
        defaultVisualMode: "loop",
      }),
    );

    window.confirm = vi.fn(() => true);

    render(<SettingsPanel isOpen onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Loop" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset app to defaults" }));

    expect(screen.getByRole("button", { name: "Map" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEYS.displaySettings)!),
    ).toMatchObject({ defaultVisualMode: "map" });
  });

  it("does not re-enable the timetable API from settings", () => {
    const { container } = render(<SettingsPanel isOpen onClose={vi.fn()} />);
    expect(container.innerHTML).not.toContain("/api/tfl/timetable");
  });
});
