import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";

describe("MobileBottomSheet", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    document.body.style.touchAction = "";
    document.body.style.paddingRight = "";
  });

  it("renders a sticky header with title and close button", () => {
    const onClose = vi.fn();
    render(
      <MobileBottomSheet
        title="Settings"
        titleId="settings-title"
        onClose={onClose}
        closeAriaLabel="Close settings"
      >
        <p>Body content</p>
      </MobileBottomSheet>,
    );

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const closeButton = screen.getByRole("button", { name: "Close settings" });
    expect(closeButton).toBeInTheDocument();
    expect(closeButton.closest("header")).not.toBeNull();

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses the body as the scroll container with overscroll containment", () => {
    const { container } = render(
      <MobileBottomSheet title="Settings" titleId="settings-title" onClose={vi.fn()}>
        <p>Scrollable settings</p>
      </MobileBottomSheet>,
    );

    const scrollContainer = container.querySelector(
      '[data-sheet-scroll-container="true"]',
    );
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer).toHaveClass("overflow-y-auto");
    expect(scrollContainer).toHaveClass("overscroll-contain");
    expect(scrollContainer).toHaveTextContent("Scrollable settings");
  });

  it("uses mobile-safe max height and bottom sheet anchoring", () => {
    render(
      <MobileBottomSheet title="Settings" titleId="settings-title" onClose={vi.fn()}>
        <p>Content</p>
      </MobileBottomSheet>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("max-h-[min(92dvh,720px)]");
    expect(dialog.className).toContain("fixed");
    expect(dialog.className).toContain("bottom-0");
    expect(dialog.className).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(dialog.className).toContain("overflow-hidden");
  });

  it("locks body scroll while open and restores it on close", () => {
    const { unmount } = render(
      <MobileBottomSheet title="Settings" titleId="settings-title" onClose={vi.fn()}>
        <p>Content</p>
      </MobileBottomSheet>,
    );

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");

    unmount();

    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.position).toBe("");
  });
});
