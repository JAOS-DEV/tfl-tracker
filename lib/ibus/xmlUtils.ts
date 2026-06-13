import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

export function parseIbusXml<T = unknown>(xml: string): T {
  return parser.parse(xml) as T;
}

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function readText(
  value: string | number | { "#text"?: string | number } | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
    const text = value["#text"];
    return text === undefined || text === null ? null : String(text).trim();
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function readAttribute(
  record: Record<string, unknown>,
  names: string[],
): string | null {
  for (const name of names) {
    const value = record[`@_${name}`];
    if (value === null || value === undefined) {
      continue;
    }

    const normalized = String(value).trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}
