import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

/** Point fluent-ffmpeg at the bundled binary (required on Vercel; harmless locally). */
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
