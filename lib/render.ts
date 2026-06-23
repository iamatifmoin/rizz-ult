import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";
import ffmpeg from "fluent-ffmpeg";
import "@/lib/ffmpeg-config";
import { writeCaptionPng } from "@/lib/caption-image";
import type { DirectorPlan } from "./director";
import type { GiphyPick } from "./assets/giphy";
import type { PexelsPick } from "./assets/pexels";

const ROOT = process.cwd();
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Vercel/Lambda only allow writes under /tmp; local dev keeps project dirs.
const TMP_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), "rizzult")
  : path.join(ROOT, "tmp");
const VIDEOS_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), "rizzult-videos")
  : path.join(ROOT, "public", "videos");

const CAPTION_TOP = 250; // px from top (upper third of the 1920px-tall frame)
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
  const captionPath = path.join(jobDir, "caption.png");
  const outAbs = path.join(VIDEOS_DIR, `${id}.mp4`);

  try {
    const lines = wrapCaption(sanitizeCaption(inputs.plan.hook_caption));

    await Promise.all([
      download(inputs.pexels.url, bgPath),
      download(inputs.giphy.url, gifPath),
      writeCaptionPng(lines, captionPath),
    ]);

    await runFfmpeg({
      bgPath,
      gifPath,
      audioPath: inputs.audioPath,
      captionPath,
      outAbs,
      plan: inputs.plan,
    });

    if (IS_SERVERLESS) {
      const buf = fs.readFileSync(outAbs);
      safeRm(outAbs);
      return `data:video/mp4;base64,${buf.toString("base64")}`;
    }

    return `/videos/${id}.mp4`;
  } finally {
    safeRm(jobDir);
  }
}

function runFfmpeg(args: {
  bgPath: string;
  gifPath: string;
  audioPath: string;
  captionPath: string;
  outAbs: string;
  plan: DirectorPlan;
}): Promise<void> {
  const { bgPath, gifPath, audioPath, captionPath, outAbs, plan } = args;
  const dur = plan.duration_seconds;
  const gifStart = plan.gif_timing === "end" ? 1 : 0;

  // drawtext is not available in ffmpeg-static on Linux/serverless, so captions
  // are pre-rendered to PNG and composited with overlay instead.
  const filter = [
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[bg]",
    "[1:v]scale=860:-1[gif]",
    `[bg][gif]overlay=x=(W-w)/2:y=H-h-150:enable='between(t,${gifStart},${dur})'[ov]`,
    "[3:v]format=rgba[caption]",
    `[ov][caption]overlay=x=(W-w)/2:y=${CAPTION_TOP}[outv]`,
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
      .input(captionPath)
      .inputOptions(["-loop", "1"])
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

function sanitizeCaption(raw: string): string {
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2015\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "wait this is actually kind of genius";
}

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

function safeRm(target: string): void {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
