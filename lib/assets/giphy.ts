export interface GiphyPick {
  url: string;
  /** "mp4" is easier to composite; "gif" is the fallback. */
  kind: "mp4" | "gif";
}

interface GiphyRendition {
  mp4?: string;
  url?: string;
}

interface GiphyItem {
  images: {
    original?: GiphyRendition;
    downsized_medium?: GiphyRendition;
  };
}

interface GiphySearchResponse {
  data: GiphyItem[];
}

/**
 * Search Giphy and return a direct mp4 (preferred) or gif render url.
 * Picks randomly from the top 5 so repeat runs aren't identical.
 */
export async function searchGiphy(query: string): Promise<GiphyPick> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    throw new Error("GIPHY_API_KEY is not set. Add it to .env.local.");
  }

  const endpoint = new URL("https://api.giphy.com/v1/gifs/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("api_key", apiKey);
  endpoint.searchParams.set("limit", "10");
  endpoint.searchParams.set("rating", "pg-13");

  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`Giphy search failed (${res.status})`);
  }

  const data = (await res.json()) as GiphySearchResponse;
  const items = data.data ?? [];

  if (items.length === 0) {
    throw new Error(`No Giphy results for "${query}"`);
  }

  const topN = items.slice(0, Math.min(5, items.length));
  const pick = topN[Math.floor(Math.random() * topN.length)];

  const original = pick.images.original;
  if (original?.mp4) {
    return { url: original.mp4, kind: "mp4" };
  }

  const gifUrl = original?.url ?? pick.images.downsized_medium?.url;
  if (gifUrl) {
    return { url: gifUrl, kind: "gif" };
  }

  throw new Error(`No usable Giphy rendition for "${query}"`);
}
