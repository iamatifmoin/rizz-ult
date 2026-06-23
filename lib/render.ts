import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import ffmpeg from "fluent-ffmpeg";
import type { DirectorPlan } from "./director";
import type { GiphyPick } from "./assets/giphy";
import type { PexelsPick } from "./assets/pexels";

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, "tmp");
const VIDEOS_DIR = path.join(ROOT, "public", "videos");
// Relative (forward-slash) path avoids Windows drive-colon escaping inside the
// drawtext filter, where ":" separates options.
const FONT_REL = "public/fonts/caption.ttf";

const RENDER_TIMEOUT_MS = 25_000;

export interface RenderInputs {
  plan: DirectorPlan;
  pexels: PexelsPick;
  giphy: GiphyPick;
  audioPath: string;
}

export async function renderVideo(inputs: RenderInputs): Promise<string> {
  ensureDir(TMP_DIR);
  ensureDir(VIDEOS_DIR);

  const id = randomUUID();
  const jobDir = path.join(TMP_DIR, id);
  ensureDir(jobDir);

  const bgPath = path.join(jobDir, "bg.mp4");
  const gifPath = path.join(jobDir, `gif.${inputs.giphy.kind}`);
  const outAbs = path.join(VIDEOS_DIR, `${id}.mp4`);

  try {
    await Promise.all([
      download(inputs.pexels.url, bgPath),
      download(inputs.giphy.url, gifPath),
    ]);

    // Sanitize to renderable ASCII (drop emojis/curly quotes/etc. that the
    // caption font can't render), then wrap into stacked lines. Each line is
    // written to its own textfile so drawtext never has to escape the text.
    const lines = wrapCaption(sanitizeCaption(inputs.plan.hook_caption));
    const lineRelPaths = lines.map((line, i) => {
      const abs = path.join(jobDir, `line${i}.txt`);
      fs.writeFileSync(abs, line, "utf8");
      return path.relative(ROOT, abs).split(path.sep).join("/");
    });

    await runFfmpeg({
      bgPath,
      gifPath,
      audioPath: inputs.audioPath,
      lineRelPaths,
      outAbs,
      plan: inputs.plan,
    });

    return `/videos/${id}.mp4`;
  } finally {
    // Best-effort cleanup of the working dir (keep the final output).
    safeRm(jobDir);
  }
}

const FONT_SIZE = 66;
const LINE_HEIGHT = 84;
const CAPTION_TOP = 250; // px from top (upper third of the 1920px-tall frame)

function runFfmpeg(args: {
  bgPath: string;
  gifPath: string;
  audioPath: string;
  lineRelPaths: string[];
  outAbs: string;
  plan: DirectorPlan;
}): Promise<void> {
  const { bgPath, gifPath, audioPath, lineRelPaths, outAbs, plan } = args;
  const dur = plan.duration_seconds;
  // The meme is the star — keep it on screen the whole clip. "end" just delays
  // it by a short beat so it can still land as a punchline; "middle" is instant.
  const gifStart = plan.gif_timing === "end" ? 1 : 0;

  // One drawtext per line, each independently centered (x=(w-text_w)/2) so the
  // block is truly center-aligned rather than left-aligned.
  const drawtextSteps = lineRelPaths.map((rel, i) => {
    const inLabel = i === 0 ? "[ov]" : `[t${i - 1}]`;
    const outLabel = i === lineRelPaths.length - 1 ? "[outv]" : `[t${i}]`;
    const y = CAPTION_TOP + i * LINE_HEIGHT;
    return (
      `${inLabel}drawtext=fontfile=${FONT_REL}:textfile=${rel}:expansion=none:` +
      `fontcolor=white:fontsize=${FONT_SIZE}:borderw=5:bordercolor=black@0.9:` +
      `x=(w-text_w)/2:y=${y}${outLabel}`
    );
  });

  const filter = [
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[bg]",
    "[1:v]scale=860:-1[gif]",
    `[bg][gif]overlay=x=(W-w)/2:y=H-h-150:enable='between(t,${gifStart},${dur})'[ov]`,
    ...drawtextSteps,
  ].join(";");

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const command = ffmpeg()
      .input(bgPath)
      .inputOptions(["-stream_loop", "-1"])
      .input(gifPath)
      .inputOptions(["-stream_loop", "-1"])
      .input(audioPath)
      .inputOptions(["-stream_loop", "-1"])
      .complexFilter(filter)
      .outputOptions([
        "-map",
        "[outv]",
        "-map",
        "2:a",
        "-t",
        String(dur),
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
      ])
      .output(outAbs);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        command.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      reject(new Error("ffmpeg render timed out"));
    }, RENDER_TIMEOUT_MS);

    command
      .on("end", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      })
      .on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      })
      .run();
  });
}

async function download(url: string, dest: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Failed to download asset (${res.status}): ${url}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reduce a caption to renderable ASCII. The bundled caption font has no glyphs
 * for emoji / curly quotes / dashes / other unicode, which render as broken
 * "tofu" boxes — so we normalize the common ones and strip the rest.
 */
function sanitizeCaption(raw: string): string {
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'") // curly single quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"') // curly double quotes
    .replace(/[\u2013\u2014\u2015\u2212]/g, "-") // en/em/minus dashes
    .replace(/\u2026/g, "...") // ellipsis
    .replace(/[^\x20-\x7E]/g, "") // drop anything else outside printable ASCII
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "wait this is actually kind of genius";
}

/** Soft-wrap a short caption into stacked lines for the vertical frame. */
function wrapCaption(caption: string, maxChars = 18): string[] {
  const words = caption.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word;
    } else if ((line + " " + word).length <= maxChars) {
      line += " " + word;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [caption.trim()];
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function safeRm(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
