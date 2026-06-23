import path from "node:path";
import fs from "node:fs";
import type { AudioMood } from "../director";

/**
 * No API here. We map each mood to a curated local clip in /public/audio.
 *
 * NOTE: the bundled clips are short synthesized placeholders (generated with
 * ffmpeg at build time) standing in for a curated royalty-free set. There is no
 * public "current TikTok trending sounds" API, so this lookup table is the
 * intentional stand-in. Drop real royalty-free mp3s in /public/audio with the
 * same filenames to upgrade.
 */
const MOOD_TO_FILE: Record<AudioMood, string> = {
  hype: "hype.mp3",
  chaotic: "chaotic.mp3",
  wholesome: "wholesome.mp3",
  dramatic: "dramatic.mp3",
  deadpan: "deadpan.mp3",
};

export function audioFileForMood(mood: AudioMood): string {
  const fileName = MOOD_TO_FILE[mood] ?? MOOD_TO_FILE.hype;
  const abs = path.join(process.cwd(), "public", "audio", fileName);

  if (!fs.existsSync(abs)) {
    // Fall back to any available clip so render never hard-fails on audio.
    const fallback = Object.values(MOOD_TO_FILE)
      .map((f) => path.join(process.cwd(), "public", "audio", f))
      .find((p) => fs.existsSync(p));
    if (!fallback) {
      throw new Error("No audio files found in /public/audio.");
    }
    return fallback;
  }

  return abs;
}
