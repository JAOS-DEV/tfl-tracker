import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(rootDir, "public", "icon.svg");
const svg = readFileSync(svgPath);

const outputs = [
  { size: 192, filename: "icon-192.png" },
  { size: 512, filename: "icon-512.png" },
];

for (const { size, filename } of outputs) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(rootDir, "public", filename));
  console.log(`Wrote public/${filename}`);
}
