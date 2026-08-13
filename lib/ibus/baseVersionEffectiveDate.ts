const BASE_VERSION_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;

export type BaseVersionDateRelation = "past" | "today" | "future" | "unknown";

export interface BaseVersionEffectiveDate {
  baseVersion: string;
  /** Calendar date labelled by the version id (YYYY-MM-DD), if parseable. */
  labelledDate: string | null;
  relationToToday: BaseVersionDateRelation;
}

/** Parse YYYYMMDD base-version ids as labelled calendar dates. */
export function parseBaseVersionLabelledDate(
  baseVersion: string,
): string | null {
  const match = BASE_VERSION_DATE_PATTERN.exec(baseVersion.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  // Validate the calendar date exists (rejects 20260231, etc.).
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** London calendar day as YYYY-MM-DD. */
export function londonCalendarDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function compareLabelledDateToToday(
  labelledDate: string | null,
  todayLondon: string = londonCalendarDate(),
): BaseVersionDateRelation {
  if (!labelledDate) {
    return "unknown";
  }
  if (labelledDate < todayLondon) {
    return "past";
  }
  if (labelledDate > todayLondon) {
    return "future";
  }
  return "today";
}

export function describeBaseVersionEffectiveDate(
  baseVersion: string,
  todayLondon: string = londonCalendarDate(),
): BaseVersionEffectiveDate {
  const labelledDate = parseBaseVersionLabelledDate(baseVersion);
  return {
    baseVersion,
    labelledDate,
    relationToToday: compareLabelledDateToToday(labelledDate, todayLondon),
  };
}

export function formatEffectiveDateRelation(
  info: BaseVersionEffectiveDate,
): string {
  if (!info.labelledDate) {
    return `${info.baseVersion} (date in name not parseable)`;
  }
  if (info.relationToToday === "future") {
    return `${info.baseVersion} (labelled ${info.labelledDate} — still in the future vs London today)`;
  }
  if (info.relationToToday === "today") {
    return `${info.baseVersion} (labelled ${info.labelledDate} — today in London)`;
  }
  return `${info.baseVersion} (labelled ${info.labelledDate} — on/before London today)`;
}
