import type { IbusVehicleDetailsState } from "@/hooks/useIbusVehicleDetails";

interface IbusDetailsSectionProps {
  registration?: string;
  vehicleReference?: string;
  details: IbusVehicleDetailsState;
}

function unavailableLabel(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "Unavailable";
}

function formatSourceLines(details: IbusVehicleDetailsState): Array<{
  label: string;
  value: string;
}> {
  const fleetSource = details.fleetSourceLabel;
  const runningSource = details.runningNumberSourceLabel;
  const uniqueSources = [
    ...new Set([fleetSource, runningSource].filter(Boolean)),
  ] as string[];

  if (uniqueSources.length === 0) {
    return [];
  }

  if (uniqueSources.length === 1) {
    return [{ label: "Source", value: uniqueSources[0]! }];
  }

  const lines: Array<{ label: string; value: string }> = [];
  if (fleetSource) {
    lines.push({ label: "Fleet source", value: fleetSource });
  }
  if (runningSource && runningSource !== fleetSource) {
    lines.push({ label: "Running source", value: runningSource });
  }

  return lines;
}

export function IbusDetailsSection({
  registration,
  vehicleReference,
  details,
}: IbusDetailsSectionProps): React.ReactElement {
  const ibus = details.ibusQuery.data;
  const isLoading =
    details.ibusQuery.isLoading || details.fleetFallbackQuery.isLoading;
  const sourceLines = formatSourceLines(details);

  return (
    <section className="mt-5 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
      <h3 className="text-sm font-semibold">Vehicle / iBus details</h3>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-zinc-500">Registration</dt>
          <dd className="font-medium">
            {unavailableLabel(registration ?? ibus?.registration)}
          </dd>
        </div>

        {vehicleReference && !registration ? (
          <div>
            <dt className="text-zinc-500">TfL vehicle reference</dt>
            <dd className="font-medium">{vehicleReference}</dd>
          </div>
        ) : null}

        <div>
          <dt className="text-zinc-500">Fleet number</dt>
          <dd className="font-medium">
            {unavailableLabel(details.displayFleetNo)}
          </dd>
        </div>

        <div>
          <dt className="text-zinc-500">Running number</dt>
          <dd className="font-medium">
            {unavailableLabel(details.runningNo)}
          </dd>
        </div>

        {ibus?.blockNo ? (
          <div>
            <dt className="text-zinc-500">Block</dt>
            <dd className="font-medium">{ibus.blockNo}</dd>
          </div>
        ) : null}

        {ibus?.garageNo ? (
          <div>
            <dt className="text-zinc-500">Garage no</dt>
            <dd className="font-medium">{ibus.garageNo}</dd>
          </div>
        ) : null}

        {ibus?.garageCode ? (
          <div>
            <dt className="text-zinc-500">Garage code</dt>
            <dd className="font-medium">{ibus.garageCode}</dd>
          </div>
        ) : null}

        {ibus?.garageName ? (
          <div>
            <dt className="text-zinc-500">Garage</dt>
            <dd className="font-medium">{ibus.garageName}</dd>
          </div>
        ) : null}

        {ibus?.operatorCode || ibus?.operatorAgency ? (
          <div>
            <dt className="text-zinc-500">Operator</dt>
            <dd className="font-medium">
              {[ibus.operatorCode, ibus.operatorAgency]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        ) : null}

        {ibus?.sourceBaseVersion ? (
          <div>
            <dt className="text-zinc-500">iBus base version</dt>
            <dd className="font-medium">{ibus.sourceBaseVersion}</dd>
          </div>
        ) : null}

        {sourceLines.map((line) => (
          <div key={line.label}>
            <dt className="text-zinc-500">{line.label}</dt>
            <dd className="font-medium">{line.value}</dd>
          </div>
        ))}
      </dl>

      {isLoading ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Loading vehicle details…
        </p>
      ) : null}

      {!isLoading && !details.displayFleetNo ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Fleet number unavailable. No fleet-number match found in TfL iBus
          Vehicle data
          {details.fleetFallbackQuery.data?.status === "unavailable"
            ? " or Bustimes fallback."
            : "."}
        </p>
      ) : null}

      {!isLoading &&
      details.displayFleetNo &&
      details.fleetSourceLabel === "Bustimes fallback data" ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Fleet number from Bustimes fallback data.
        </p>
      ) : null}

      {!isLoading && !details.runningNo ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {ibus?.message ??
            "Running number unavailable. This live prediction may not include the trip/base-version data needed for running-number matching."}
        </p>
      ) : null}
    </section>
  );
}
