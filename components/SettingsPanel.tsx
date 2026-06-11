"use client";

import { useState } from "react";
import { AboutDataContent } from "@/components/AboutDataContent";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAllRouteHistory } from "@/hooks/useRouteHistory";
import { useDisplaySettings } from "@/hooks/useDisplaySettings";
import {
  DEFAULT_DISPLAY_SETTINGS,
  type DefaultVisualMode,
} from "@/lib/displaySettings";
import {
  exportSnapshotsAsJson,
  loadAllSnapshots,
} from "@/lib/localRouteHistory";
import { DEFAULT_LARGE_GAP_MINUTES } from "@/lib/routeAlerts";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SegmentedOption<T extends string>({
  value,
  current,
  label,
  onSelect,
}: {
  value: T;
  current: T;
  label: string;
  onSelect: (value: T) => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={current === value}
      className={`min-h-10 flex-1 rounded-md px-3 py-2 text-sm font-medium ${
        current === value
          ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
      }`}
    >
      {label}
    </button>
  );
}

export function SettingsPanel({
  isOpen,
  onClose,
}: SettingsPanelProps): React.ReactElement | null {
  const [settings, setSettings] = useDisplaySettings();
  const { clearAll } = useAllRouteHistory();
  const [aboutOpen, setAboutOpen] = useState(false);

  if (!isOpen) {
    return null;
  }

  const updateDefaultVisualMode = (defaultVisualMode: DefaultVisualMode) => {
    setSettings((current) => ({ ...current, defaultVisualMode }));
  };

  const updateGlobalAlert = (
    patch: Partial<typeof settings.globalAlertDefaults>,
  ) => {
    setSettings((current) => ({
      ...current,
      globalAlertDefaults: { ...current.globalAlertDefaults, ...patch },
    }));
  };

  return (
    <MobileBottomSheet title="Settings" titleId="settings-title" onClose={onClose}>
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Display
          </h3>
          <div>
            <p className="mb-2 text-sm text-zinc-700 dark:text-zinc-300">
              Default view
            </p>
            <div className="inline-flex w-full rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
              <SegmentedOption
                value="loop"
                current={settings.defaultVisualMode}
                label="Loop"
                onSelect={updateDefaultVisualMode}
              />
              <SegmentedOption
                value="list"
                current={settings.defaultVisualMode}
                label="List"
                onSelect={updateDefaultVisualMode}
              />
            </div>
          </div>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Compact route cards</span>
            <input
              type="checkbox"
              checked={settings.compactRouteCards}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  compactRouteCards: event.target.checked,
                }))
              }
              className="h-5 w-5"
            />
          </label>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Show service details inline</span>
            <input
              type="checkbox"
              checked={settings.showServiceDetailsInline}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  showServiceDetailsInline: event.target.checked,
                }))
              }
              className="h-5 w-5"
            />
          </label>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Show history inline</span>
            <input
              type="checkbox"
              checked={settings.showHistoryInline}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  showHistoryInline: event.target.checked,
                }))
              }
              className="h-5 w-5"
            />
          </label>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Show advanced diagnostics</span>
            <input
              type="checkbox"
              checked={settings.showAdvancedDiagnostics}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  showAdvancedDiagnostics: event.target.checked,
                }))
              }
              className="h-5 w-5"
            />
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Service details, history, and alerts are always available from each
            route card. Inline options add them directly to the card scroll.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Appearance
          </h3>
          <ThemeToggle />
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Alert defaults
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Defaults for new routes. Each active route can override these in
            its Alerts panel.
          </p>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Warn on large gaps</span>
            <input
              type="checkbox"
              checked={settings.globalAlertDefaults.warnLargeGap}
              onChange={(event) =>
                updateGlobalAlert({ warnLargeGap: event.target.checked })
              }
              className="h-5 w-5"
            />
          </label>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Large gap threshold (minutes)</span>
            <input
              type="number"
              min={1}
              max={60}
              value={settings.globalAlertDefaults.largeGapMinutes}
              disabled={!settings.globalAlertDefaults.warnLargeGap}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                updateGlobalAlert({
                  largeGapMinutes: Number.isFinite(value)
                    ? value
                    : DEFAULT_LARGE_GAP_MINUTES,
                });
              }}
              className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-right dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Warn on possible bunching</span>
            <input
              type="checkbox"
              checked={settings.globalAlertDefaults.warnBunching}
              onChange={(event) =>
                updateGlobalAlert({ warnBunching: event.target.checked })
              }
              className="h-5 w-5"
            />
          </label>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Warn when no live buses</span>
            <input
              type="checkbox"
              checked={settings.globalAlertDefaults.warnNoLiveBuses}
              onChange={(event) =>
                updateGlobalAlert({ warnNoLiveBuses: event.target.checked })
              }
              className="h-5 w-5"
            />
          </label>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Warn on stale data</span>
            <input
              type="checkbox"
              checked={settings.globalAlertDefaults.warnStaleData}
              onChange={(event) =>
                updateGlobalAlert({ warnStaleData: event.target.checked })
              }
              className="h-5 w-5"
            />
          </label>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Warn on possible ghosts</span>
            <input
              type="checkbox"
              checked={settings.globalAlertDefaults.warnPossibleGhost}
              onChange={(event) =>
                updateGlobalAlert({ warnPossibleGhost: event.target.checked })
              }
              className="h-5 w-5"
            />
          </label>

          <button
            type="button"
            onClick={() =>
              setSettings((current) => ({
                ...current,
                globalAlertDefaults: DEFAULT_DISPLAY_SETTINGS.globalAlertDefaults,
              }))
            }
            className="text-sm text-zinc-600 underline dark:text-zinc-300"
          >
            Reset alert defaults
          </button>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Local history
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            History is stored locally for up to 24 hours and only while the app
            was open on this device.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  "all-route-history.json",
                  exportSnapshotsAsJson(loadAllSnapshots()),
                  "application/json",
                )
              }
              className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Export all JSON
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Clear all local route history on this device?",
                  )
                ) {
                  clearAll();
                }
              }}
              className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Clear all history
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            About &amp; Data
          </h3>
          <button
            type="button"
            onClick={() => setAboutOpen((current) => !current)}
            className="min-h-11 text-sm font-medium text-sky-700 underline dark:text-sky-300"
          >
            {aboutOpen ? "Hide details" : "Show details"}
          </button>
          {aboutOpen ? <AboutDataContent /> : null}
        </section>
      </div>
    </MobileBottomSheet>
  );
}
