import unzipper from "unzipper";

export async function extractXmlFiles(
  zipBuffer: Buffer,
  matcher: (fileName: string) => boolean,
): Promise<Array<{ name: string; content: string }>> {
  const archive = await unzipper.Open.buffer(zipBuffer);
  const results: Array<{ name: string; content: string }> = [];

  for (const entry of archive.files) {
    if (entry.type !== "File" || !matcher(entry.path)) {
      continue;
    }

    const content = (await entry.buffer()).toString("utf8");
    results.push({ name: entry.path, content });
  }

  return results;
}
