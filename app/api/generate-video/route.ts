import { NextRequest } from "next/server";
import { scrapeUrl } from "@/lib/scrape";
import { directVideo } from "@/lib/director";
import { searchPexelsVideo } from "@/lib/assets/pexels";
import { searchGiphy } from "@/lib/assets/giphy";
import { audioFileForMood } from "@/lib/assets/audio";
import { renderVideo } from "@/lib/render";

export const runtime = "nodejs";
// The whole pipeline (scrape -> director -> fetch -> ffmpeg) runs in one
// request. Fine for a take-home; a production build would make this an async
// job with a poll/webhook so we don't hold an HTTP connection open this long.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let message = "";
  let url: string | null = null;

  try {
    const body = await req.json();
    message = typeof body?.message === "string" ? body.message : "";
    url = typeof body?.url === "string" ? body.url : null;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!message.trim() && !url) {
    return Response.json({ error: "Nothing to work with" }, { status: 400 });
  }

  // 1) Scrape (graceful fallback to the user's own words).
  let scrapeFailed = false;
  let scrapedContent = "";
  if (url) {
    const scraped = await scrapeUrl(url);
    scrapeFailed = !scraped.ok;
    scrapedContent = scraped.content;
  }

  // 2) Creative director plan.
  let plan;
  try {
    plan = await directVideo({ userMessage: message, scrapedContent });
  } catch (err) {
    return Response.json(
      {
        error:
          "I couldn't put together a creative plan just now — mind trying again?",
        detail: errMsg(err),
      },
      { status: 502 }
    );
  }

  // 3) Fetch assets in parallel.
  let pexels, giphy, audioPath;
  try {
    [pexels, giphy] = await Promise.all([
      searchPexelsVideo(plan.pexels_query),
      searchGiphy(plan.giphy_query),
    ]);
    audioPath = audioFileForMood(plan.audio_mood);
  } catch (err) {
    return Response.json(
      {
        error:
          "I had trouble scouting the right footage or GIF — mind trying again?",
        detail: errMsg(err),
      },
      { status: 502 }
    );
  }

  // 4) Composite with ffmpeg.
  try {
    const videoUrl = await renderVideo({ plan, pexels, giphy, audioPath });
    return Response.json({
      videoUrl,
      caption: plan.hook_caption,
      plan,
      scrapeFailed,
    });
  } catch (err) {
    return Response.json(
      {
        error: "Hit a snag assembling the video — mind trying again?",
        detail: errMsg(err),
      },
      { status: 500 }
    );
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
