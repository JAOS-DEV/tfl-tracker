import { parseIbusXml } from "@/lib/ibus/xmlUtils";

export function parseBaseVersionXml(xml: string): string {
  const parsed = parseIbusXml<{
    Versioning_Of_Data?: { Base_Version?: string };
  }>(xml);

  const baseVersion = parsed.Versioning_Of_Data?.Base_Version?.trim();
  if (!baseVersion) {
    throw new Error("Base version not found in Base_Version.xml");
  }

  return baseVersion;
}
