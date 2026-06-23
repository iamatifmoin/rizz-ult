import path from "node:path";
import fs from "node:fs";
import { parse, type Font } from "opentype.js";
import sharp from "sharp";

const FONT_SIZE = 66;
const LINE_HEIGHT = 84;
const WIDTH = 1080;
const STROKE_WIDTH = 5;

let font: Font | null = null;

/**
 * Rasterize stacked caption lines to a transparent PNG for ffmpeg overlay.
 * Uses opentype.js paths so text renders on every platform (sharp/librsvg on
 * Linux does not reliably load @font-face data URIs).
 */
export async function writeCaptionPng(
  lines: string[],
  outPath: string
): Promise<void> {
  const paddingTop = 10;
  const height = paddingTop + lines.length * LINE_HEIGHT + 20;
  const svg = buildCaptionSvg(lines, height);

  await sharp(Buffer.from(svg)).png().toFile(outPath);

  const visible = await countVisiblePixels(outPath);
  if (visible === 0) {
    throw new Error("Caption PNG rendered empty — font rasterization failed");
  }
}

function buildCaptionSvg(lines: string[], height: number): string {
  const f = getFont();
  const paths = lines.map((line, i) => {
    const y = paddingTop() + FONT_SIZE + i * LINE_HEIGHT;
    const advance = f.getAdvanceWidth(line, FONT_SIZE);
    const x = (WIDTH - advance) / 2;
    const d = f.getPath(line, x, y, FONT_SIZE).toPathData(2);
    return (
      `<path d="${d}" fill="white" stroke="black" stroke-width="${STROKE_WIDTH}" ` +
      `paint-order="stroke fill" stroke-linejoin="round"/>`
    );
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${paths.join("\n  ")}
</svg>`;
}

function paddingTop(): number {
  return 10;
}

function getFont(): Font {
  if (!font) {
    const fontPath = path.join(process.cwd(), "public", "fonts", "caption.ttf");
    const buf = fs.readFileSync(fontPath);
    font = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return font;
}

async function countVisiblePixels(pngPath: string): Promise<number> {
  const { data } = await sharp(pngPath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  let visible = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) visible++;
  }
  return visible;
}
