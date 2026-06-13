const LONDON_TIME_ZONE = "Europe/London";

export interface LondonDateParts {
  year: number;
  month: number;
  day: number;
}

export interface LondonTimeParts {
  hour: number;
  minute: number;
}

export interface ParsedTflJourneyTime extends LondonTimeParts {
  hourTwentyFour: boolean;
}

export function readLondonDateParts(date: Date): LondonDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

export function readLondonTimeParts(date: Date): LondonTimeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value),
    minute: Number(parts.find((part) => part.type === "minute")?.value),
  };
}

function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const zonedDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return zonedDate.getTime() - utcDate.getTime();
}

export function buildLondonDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMs = getTimeZoneOffsetMs(LONDON_TIME_ZONE, utcGuess);
  return new Date(utcGuess.getTime() - offsetMs);
}

export function addLondonCalendarDays(
  year: number,
  month: number,
  day: number,
  days: number,
): LondonDateParts {
  const anchor = buildLondonDate(year, month, day, 12, 0);
  const shifted = new Date(anchor.getTime() + days * 24 * 60 * 60 * 1000);
  return readLondonDateParts(shifted);
}

export function parseTflJourneyTime(
  hour: string,
  minute: string,
): ParsedTflJourneyTime {
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);

  if (parsedHour >= 24) {
    return {
      hour: parsedHour - 24,
      minute: Number.isFinite(parsedMinute) ? parsedMinute : 0,
      hourTwentyFour: true,
    };
  }

  return {
    hour: Number.isFinite(parsedHour) ? parsedHour : 0,
    minute: Number.isFinite(parsedMinute) ? parsedMinute : 0,
    hourTwentyFour: false,
  };
}

function pickClosestInstantToReference(
  candidates: Date[],
  reference: Date,
): Date {
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate.getTime() - reference.getTime()) <
    Math.abs(best.getTime() - reference.getTime())
      ? candidate
      : best,
  );
}

export function buildScheduledDate(
  hour: string,
  minute: string,
  reference: Date,
): Date {
  const { hour: parsedHour, minute: parsedMinute, hourTwentyFour } =
    parseTflJourneyTime(hour, minute);
  const base = readLondonDateParts(reference);
  const candidates: Date[] = [];

  for (const dayShift of [-1, 0, 1]) {
    const date = addLondonCalendarDays(
      base.year,
      base.month,
      base.day,
      dayShift,
    );
    let candidate = buildLondonDate(
      date.year,
      date.month,
      date.day,
      parsedHour,
      parsedMinute,
    );

    if (hourTwentyFour) {
      const nextDay = addLondonCalendarDays(date.year, date.month, date.day, 1);
      candidate = buildLondonDate(
        nextDay.year,
        nextDay.month,
        nextDay.day,
        parsedHour,
        parsedMinute,
      );
    }

    candidates.push(candidate);
  }

  return pickClosestInstantToReference(candidates, reference);
}

export function alignScheduledInstantToReference(
  scheduledArrival: string,
  reference: Date,
  referenceDate = readLondonDateParts(reference),
): Date {
  const { hour, minute } = readLondonTimeParts(new Date(scheduledArrival));
  const candidates: Date[] = [];

  for (const dayShift of [-1, 0, 1]) {
    const date = addLondonCalendarDays(
      referenceDate.year,
      referenceDate.month,
      referenceDate.day,
      dayShift,
    );
    candidates.push(
      buildLondonDate(date.year, date.month, date.day, hour, minute),
    );
  }

  return pickClosestInstantToReference(candidates, reference);
}
