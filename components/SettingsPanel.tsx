"use client";

import { useState } from "react";
import { AboutDataContent } from "@/components/AboutDataContent";
import { IbusDataVersionSection } from "@/components/IbusDataVersionSection";
import { MobileBottomSheet } from "@/components/MobileBottomSheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useDisplaySettings } from "@/hooks/useDisplaySettings";
import {
  DEFAULT_DISPLAY_SETTINGS,
  type DefaultVisualMode,
} from "@/lib/displaySettings";
import {
  exportSnapshotsAsJson,
  loadAllSnapshots,
} from "@/lib/localRouteHistory";
import { resetAppToDefaults } from "@/lib/resetAppDefaults";

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

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Smooth bus movement</span>
            <input
              type="checkbox"
              checked={settings.smoothBusMovement}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  smoothBusMovement: event.target.checked,
                }))
              }
              className="h-5 w-5"
            />
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Animate estimated bus positions between TfL refreshes. This is a
            visual estimate only and does not increase live-data polling.
          </p>

          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Show possible ghost buses</span>
            <input
              type="checkbox"
              checked={settings.showScheduleGhosts}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  showScheduleGhosts: event.target.checked,
                }))
              }
              className="h-5 w-5"
            />
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Show buses that may be missing from the live feed, based on live TfL
            data and iBus schedule checks.
          </p>

          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Loop bus labels
            </p>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
              <span>Show registration</span>
              <input
                type="checkbox"
                checked={settings.showBusRegistrationOnLoop}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    showBusRegistrationOnLoop: event.target.checked,
                  }))
                }
                className="h-5 w-5"
              />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
              <span>Show fleet number</span>
              <input
                type="checkbox"
                checked={settings.showBusFleetNumberOnLoop}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    showBusFleetNumberOnLoop: event.target.checked,
                  }))
                }
                className="h-5 w-5"
              />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
              <span>Show running number</span>
              <input
                type="checkbox"
                checked={settings.showBusRunningNumberOnLoop}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    showBusRunningNumberOnLoop: event.target.checked,
                  }))
                }
                className="h-5 w-5"
              />
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Show extra vehicle identifiers beside bus markers on the loop view.
              Too many labels may clutter small screens.
            </p>
          </div>
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
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Sharing &amp; privacy
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Share links copy your active routes to the URL, for example{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              ?routes=337,220&amp;view=loop
            </code>
            . Stop links use{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              ?stop=490000001A
            </code>
            . Nothing is stored on a server.
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Nearby stops uses your browser location only when you tap “Find
            stops near me”. Location is not saved or sent anywhere except the
            TfL nearby stop lookup.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Reset app
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Reset this app to factory defaults on this device. This clears
            active routes, recent routes, favourite routes and stops, alert
            preferences, performance history, and restores all display and theme
            settings.
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
              Export performance history
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Reset this app to factory defaults on this device? This clears active routes, favourites, recent routes, alert preferences, performance history, and restores all settings.",
                  )
                ) {
                  resetAppToDefaults();
                  setSettings(DEFAULT_DISPLAY_SETTINGS);
                }
              }}
              className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Reset app to defaults
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
          {aboutOpen ? (
            <div className="space-y-4">
              <IbusDataVersionSection />
              <AboutDataContent />
            </div>
          ) : null}
        </section>
      </div>
    </MobileBottomSheet>
  );
}
