"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

const MENU_MIN_WIDTH = 180;

interface RouteCardMoreMenuProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onRemove: () => void;
  onShare: () => void;
  onOpenAlerts: () => void;
  onOpenRouteInfo: () => void;
}

export function RouteCardMoreMenu({
  isExpanded,
  onToggleExpanded,
  isFavourite,
  onToggleFavourite,
  onRemove,
  onShare,
  onOpenAlerts,
  onOpenRouteInfo,
}: RouteCardMoreMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(rect.right - MENU_MIN_WIDTH, window.innerWidth - MENU_MIN_WIDTH - 8),
    );

    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left,
      width: MENU_MIN_WIDTH,
      zIndex: 60,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const handleAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  const menu = open && menuStyle ? (
    <div
      ref={menuRef}
      role="menu"
      style={menuStyle}
      className="rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction(onToggleExpanded)}
        className="flex min-h-11 w-full items-center px-4 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {isExpanded ? "Collapse route" : "Expand route"}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction(onToggleFavourite)}
        className="flex min-h-11 w-full items-center px-4 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {isFavourite ? "★ Unfavourite" : "☆ Favourite"}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction(onShare)}
        className="flex min-h-11 w-full items-center px-4 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Share route
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction(onOpenAlerts)}
        className="flex min-h-11 w-full items-center px-4 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Alert settings
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction(onOpenRouteInfo)}
        className="flex min-h-11 w-full items-center px-4 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Route info
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => handleAction(onRemove)}
        className="flex min-h-11 w-full items-center px-4 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
      >
        Remove route
      </button>
    </div>
  ) : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More route actions"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        ⋯
      </button>

      {typeof document !== "undefined" && menu
        ? createPortal(menu, document.body)
        : null}
    </div>
  );
}
