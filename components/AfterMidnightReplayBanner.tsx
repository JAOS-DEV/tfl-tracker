interface AfterMidnightReplayBannerProps {
  scenario: string;
  simulatedNow: string;
  provenance: "synthetic-known-sample" | "recorded-tfl-response";
}

export function AfterMidnightReplayBanner({
  simulatedNow,
  provenance,
}: AfterMidnightReplayBannerProps): React.ReactElement {
  const londonTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(simulatedNow));
  const provenanceLabel =
    provenance === "recorded-tfl-response"
      ? "recorded TfL response"
      : "synthetic sample — not a recorded TfL response";

  return (
    <div className="border-b border-amber-400 bg-amber-300 px-4 py-2 text-xs font-semibold text-amber-950">
      SIMULATED DATA · {londonTime} London · {provenanceLabel}
    </div>
  );
}
