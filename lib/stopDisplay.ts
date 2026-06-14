interface StopSearchDetail {
  towards?: string;
  routesServed: string[];
}

export function normalizeStopLetterDisplay(
  rawLetter?: string,
  stopPointId?: string,
): string | undefined {
  if (rawLetter?.trim()) {
    const trimmed = rawLetter.trim();
    const stopPrefixMatch = /^stop\s+([A-Za-z])$/i.exec(trimmed);
    if (stopPrefixMatch) {
      return stopPrefixMatch[1]!.toUpperCase();
    }
    if (/^[A-Za-z]$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
  }

  if (stopPointId) {
    const naptanMatch = /^490\d+([A-Z])$/i.exec(stopPointId);
    if (naptanMatch) {
      return naptanMatch[1]!.toUpperCase();
    }
  }

  return undefined;
}

export function formatStopTitle(name: string, stopLetter?: string): string {
  const letter = normalizeStopLetterDisplay(stopLetter);
  return letter ? `${name} (${letter})` : name;
}

export function formatStopSearchSubtitle(
  stop: StopSearchDetail,
): string | undefined {
  const parts: string[] = [];

  if (stop.towards?.trim()) {
    const towards = stop.towards.trim();
    parts.push(
      towards.toLowerCase().startsWith("towards")
        ? towards
        : `Towards ${towards}`,
    );
  }

  if (stop.routesServed.length > 0) {
    parts.push(stop.routesServed.slice(0, 6).join(", "));
  }

  return parts.length > 0 ? parts.join(" · ") : undefined;
}
