export interface PexelsPick {
  url: string;
  width: number;
  height: number;
}

interface PexelsVideoFile {
  link: string;
  width: number | null;
  height: number | null;
  quality: string;
  file_type: string;
}

interface PexelsVideo {
  width: number;
  height: number;
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
}

/**
 * Search Pexels for a vertical (portrait) stock clip and return the direct mp4
 * link closest to 720p height.
 */
export async function searchPexelsVideo(query: string): Promise<PexelsPick> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error("PEXELS_API_KEY is not set. Add it to .env.local.");
  }

  const endpoint = new URL("https://api.pexels.com/videos/search");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("orientation", "portrait");
  endpoint.searchParams.set("per_page", "5");

  const res = await fetch(endpoint, {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    throw new Error(`Pexels search failed (${res.status})`);
  }

  const data = (await res.json()) as PexelsSearchResponse;
  const videos = data.videos ?? [];

  if (videos.length === 0) {
    throw new Error(`No Pexels videos found for "${query}"`);
  }

  // Prefer a portrait clip; pick the mp4 file closest to 720p tall.
  const portrait =
    videos.find((v) => v.height >= v.width) ?? videos[0];

  const mp4Files = portrait.video_files
    .filter((f) => f.file_type === "video/mp4" && f.link)
    .filter((f) => (f.height ?? 0) >= (f.width ?? 0)); // portrait files

  const candidates = mp4Files.length > 0 ? mp4Files : portrait.video_files.filter((f) => f.link);

  if (candidates.length === 0) {
    throw new Error(`No usable Pexels mp4 for "${query}"`);
  }

  const best = candidates.reduce((a, b) =>
    Math.abs((a.height ?? 0) - 1280) <= Math.abs((b.height ?? 0) - 1280) ? a : b
  );

  return {
    url: best.link,
    width: best.width ?? portrait.width,
    height: best.height ?? portrait.height,
  };
}
