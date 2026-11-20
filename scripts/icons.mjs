/**
 * Generates the installable-app icon set from public/icon.svg so the PNGs never
 * drift from the vector. Run by `npm run build` before the prerender step.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = new URL("../public/", import.meta.url);
const svg = await readFile(new URL("icon.svg", publicDir));

async function png(size, name, { maskable = false } = {}) {
  const image = sharp(svg, { density: Math.max(72, Math.round((size / 64) * 72)) }).resize(size, size);
  if (maskable) {
    // Maskable icons are cropped to a circle: keep the mark inside the safe zone.
    const inner = Math.round(size * 0.6);
    const pad = Math.round((size - inner) / 2);
    const mark = await sharp(svg, { density: Math.max(72, Math.round((inner / 64) * 72)) }).resize(inner, inner).png().toBuffer();
    const out = await sharp({
      create: { width: size, height: size, channels: 4, background: "#111113" },
    })
      .composite([{ input: mark, top: pad, left: pad }])
      .png()
      .toBuffer();
    await writeFile(new URL(name, publicDir), out);
    return out.length;
  }
  const out = await image.png().toBuffer();
  await writeFile(new URL(name, publicDir), out);
  return out.length;
}

const sizes = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, {}],
];

for (const [name, size, options] of sizes) {
  const bytes = await png(size, name, options);
  console.log(`icons: ${name} (${size}px, ${bytes} bytes)`);
}
