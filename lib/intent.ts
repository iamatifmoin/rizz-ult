import { CLAUDE_MODEL, extractJson, getAnthropic, textFromMessage } from "./anthropic";

export type Intent = "chat" | "video_request";

export interface IntentResult {
  intent: Intent;
  url: string | null;
}

const URL_REGEX = /\bhttps?:\/\/[^\s)]+|\bwww\.[^\s)]+|\b[a-z0-9-]+\.(?:app|io|com|co|ai|dev|net|org|xyz|shop|store)(?:\/[^\s)]*)?/i;

export function extractUrl(message: string): string | null {
  const match = message.match(URL_REGEX);
  if (!match) return null;
  let url = match[0].replace(/[.,;]+$/, "");
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

/**
 * Classify a user message as casual chat or a request to build a video.
 *
 * Fast path: if the message contains a URL AND looks like it's describing a
 * product, we skip the Claude round-trip entirely. We only ask Claude when the
 * message is ambiguous (has product-ish language but no URL, or is long).
 */
export async function classifyIntent(message: string): Promise<IntentResult> {
  const url = extractUrl(message);

  if (url) {
    return { intent: "video_request", url };
  }

  // Cheap heuristics before spending a Claude call.
  const trimmed = message.trim();
  const wordCount = trimmed.split(/\s+/).length;
  const looksCasual =
    wordCount <= 4 &&
    /^(hi|hey|hello|yo|sup|what'?s up|help|what can you do|who are you|thanks|thank you|ok|cool)/i.test(
      trimmed
    );

  if (looksCasual) {
    return { intent: "chat", url: null };
  }

  // Ambiguous: ask Claude to decide.
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 120,
      system:
        "You classify a single user message for a UGC video-generator chatbot. " +
        'Return STRICT JSON only, no markdown: {"intent":"chat"|"video_request","url":string|null}. ' +
        'Use "video_request" when the user describes a product/app/brand they want turned into a marketing video. ' +
        'Use "chat" for greetings, questions about the tool, or general conversation. ' +
        "Extract a URL if one is present, otherwise null.",
      messages: [{ role: "user", content: trimmed }],
    });

    const parsed = extractJson<IntentResult>(textFromMessage(response));
    return {
      intent: parsed.intent === "video_request" ? "video_request" : "chat",
      url: parsed.url ?? null,
    };
  } catch {
    // If classification fails, default to chat so we never crash the turn.
    return { intent: "chat", url: null };
  }
}
