export interface ScrapeResult {
  ok: boolean;
  title: string;
  description: string;
  text: string;
  /** Combined, trimmed blob handed to the creative director. */
  content: string;
}

/**
 * Lightweight, no-headless-browser scrape: plain fetch + regex strip.
 * Speed is prioritised over perfect extraction (per the brief).
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A real-ish UA avoids the most trivial bot blocks.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return empty();
    }

    const html = await res.text();
    const title = matchOne(html, /<title[^>]*>([^<]*)<\/title>/i);
    const description =
      matchOne(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
      matchOne(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);

    const text = visibleText(html).slice(0, 2000);

    const content = [
      title && `Title: ${title}`,
      description && `Description: ${description}`,
      text && `Page text: ${text}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      ok: content.length > 0,
      title,
      description,
      text,
      content,
    };
  } catch {
    return empty();
  }
}

function empty(): ScrapeResult {
  return { ok: false, title: "", description: "", text: "", content: "" };
}

function matchOne(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : "";
}

function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}
