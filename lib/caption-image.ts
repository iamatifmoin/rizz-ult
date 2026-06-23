import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";

const FONT_SIZE = 66;
const LINE_HEIGHT = 84;
const WIDTH = 1080;

let fontBase64: string | null = null;

/** Rasterize stacked caption lines to a transparent PNG for ffmpeg overlay. */
export async function writeCaptionPng(
  lines: string[],
  outPath: string
): Promise<void> {
  const paddingTop = 10;
  const height = paddingTop + lines.length * LINE_HEIGHT + 20;

  const textEls = lines
    .map((line, i) => {
      const y = paddingTop + FONT_SIZE + i * LINE_HEIGHT;
      return `<text x="540" y="${y}" text-anchor="middle" class="cap">${escapeXml(line)}</text>`;
    })
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'Caption';
        src: url('data:font/truetype;charset=utf-8;base64,${getFontBase64()}') format('truetype');
      }
      .cap {
        font-family: 'Caption', sans-serif;
        font-size: ${FONT_SIZE}px;
        fill: white;
        stroke: black;
        stroke-width: 5px;
        paint-order: stroke fill;
      }
    </style>
  </defs>
  ${textEls}
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(outPath);
}

function getFontBase64(): string {
  if (!fontBase64) {
    const fontPath = path.join(process.cwd(), "public", "fonts", "caption.ttf");
    fontBase64 = fs.readFileSync(fontPath).toString("base64");
  }
  return fontBase64;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
