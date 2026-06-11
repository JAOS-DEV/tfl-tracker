export function formatMinutes(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  return `${minutes} min`;
}

export function formatDueLabel(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes <= 0) {
    return "Due";
  }
  if (minutes === 1) {
    return "1 min";
  }
  return `${minutes} min`;
}

export function formatLocalTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLastUpdated(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function wrapStopLabel(
  text: string,
  maxCharsPerLine: number,
  maxLines = 2,
): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxCharsPerLine) {
    return [normalized];
  }

  const lines: string[] = [];
  let rest = normalized;

  for (let lineIndex = 0; lineIndex < maxLines && rest.length > 0; lineIndex += 1) {
    const isLastAllowedLine = lineIndex === maxLines - 1;

    if (rest.length <= maxCharsPerLine) {
      lines.push(rest);
      return lines;
    }

    let splitAt = -1;
    const searchWindow = rest.slice(0, maxCharsPerLine + 1);
    for (let index = searchWindow.length - 1; index > 0; index -= 1) {
      if (searchWindow[index] === " ") {
        splitAt = index;
        break;
      }
    }

    if (splitAt <= 0) {
      splitAt = maxCharsPerLine;
    }

    let line = rest.slice(0, splitAt).trim();
    rest = rest.slice(splitAt).trim();

    if (isLastAllowedLine && rest.length > 0) {
      const combined = `${line} ${rest}`.trim();
      line =
        combined.length > maxCharsPerLine
          ? `${combined.slice(0, maxCharsPerLine - 1)}…`
          : combined;
      rest = "";
    }

    lines.push(line);
  }

  return lines;
}

export function formatCountdown(target: Date, now: Date): string {
  const diffMs = Math.max(0, target.getTime() - now.getTime());
  const seconds = Math.ceil(diffMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
