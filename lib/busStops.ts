const HUB_NAPTAN_PATTERN = /^HUB/i;
const TRANSPORT_INTERCHANGE_STOP_TYPE = "transportinterchange";

interface StopPointIdentity {
  id?: string;
  naptanId?: string;
}

interface TfLBusStopCandidate extends StopPointIdentity {
  modes?: string[];
  stopType?: string;
}

export function getStopPointId(stop: StopPointIdentity): string {
  return stop.id ?? stop.naptanId ?? "";
}

export function isTransportHubStop(
  stopPointId: string,
  stopType?: string,
): boolean {
  if (HUB_NAPTAN_PATTERN.test(stopPointId)) {
    return true;
  }

  return stopType?.toLowerCase() === TRANSPORT_INTERCHANGE_STOP_TYPE;
}

export function isTfLBusStopCandidate(stop: TfLBusStopCandidate): boolean {
  const stopPointId = getStopPointId(stop);
  if (!stopPointId || isTransportHubStop(stopPointId, stop.stopType)) {
    return false;
  }

  return (stop.modes ?? []).some((mode) => mode.toLowerCase() === "bus");
}

export function isBusModePrediction(prediction: { modeName: string }): boolean {
  return prediction.modeName.toLowerCase() === "bus";
}
