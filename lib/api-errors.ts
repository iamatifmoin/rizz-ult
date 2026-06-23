export type ErrorSource =
  | "anthropic"
  | "pexels"
  | "giphy"
  | "network"
  | "app";

export type ErrorKind =
  | "overloaded"
  | "rate_limit"
  | "billing"
  | "upstream"
  | "config"
  | "internal";

export interface ApiErrorPayload {
  error: string;
  detail?: string;
  errorSource: ErrorSource;
  errorKind: ErrorKind;
  /** True when the failure is outside this app (API outage, rate limits, etc.). */
  external: boolean;
}

export function classifyApiError(
  err: unknown,
  context: ErrorSource = "app"
): ApiErrorPayload {
  const detail = err instanceof Error ? err.message : String(err);
  const lower = detail.toLowerCase();

  if (/overloaded|529/.test(lower)) {
    return payload({
      error:
        "Claude's API is momentarily overloaded. This isn't a Rizz-ult bug — wait a few seconds and try again.",
      detail,
      errorSource: "anthropic",
      errorKind: "overloaded",
      external: true,
    });
  }

  if (/rate_limit|429/.test(lower)) {
    return payload({
      error:
        "Claude rate limit hit. Slow down for a moment and try again — nothing wrong on your end.",
      detail,
      errorSource: "anthropic",
      errorKind: "rate_limit",
      external: true,
    });
  }

  if (/billing|402/.test(lower)) {
    return payload({
      error:
        "There's a billing issue on the Anthropic account behind this app. Check console.anthropic.com.",
      detail,
      errorSource: "anthropic",
      errorKind: "billing",
      external: true,
    });
  }

  if (/anthropic_api_key|authentication_error|401/.test(lower)) {
    return payload({
      error: "The app's Claude API key isn't configured correctly.",
      detail,
      errorSource: "app",
      errorKind: "config",
      external: false,
    });
  }

  if (context === "pexels" || /pexels/.test(lower)) {
    return payload({
      error:
        "Pexels couldn't return footage right now. Their API may be down or rate-limited — try again shortly.",
      detail,
      errorSource: "pexels",
      errorKind: "upstream",
      external: true,
    });
  }

  if (context === "giphy" || /giphy/.test(lower)) {
    return payload({
      error:
        "Giphy couldn't return a GIF right now. Their API may be down or rate-limited — try again shortly.",
      detail,
      errorSource: "giphy",
      errorKind: "upstream",
      external: true,
    });
  }

  if (context === "anthropic") {
    return payload({
      error:
        "Claude didn't respond in time. That's usually temporary — try again in a moment.",
      detail,
      errorSource: "anthropic",
      errorKind: "upstream",
      external: true,
    });
  }

  if (/fetch failed|network|econnreset|etimedout|abort/.test(lower)) {
    return payload({
      error:
        "Network hiccup reaching an external service. Check your connection and try again.",
      detail,
      errorSource: "network",
      errorKind: "upstream",
      external: true,
    });
  }

  if (/ffmpeg|render timed out/.test(lower)) {
    return payload({
      error:
        "Video assembly failed on our server. If this keeps happening, the deploy may need a tweak.",
      detail,
      errorSource: "app",
      errorKind: "internal",
      external: false,
    });
  }

  return payload({
    error: fallbackMessage(context),
    detail,
    errorSource: context,
    errorKind: "internal",
    external: context !== "app",
  });
}

function fallbackMessage(context: ErrorSource): string {
  switch (context) {
    case "anthropic":
      return "I couldn't put together a creative plan just now — mind trying again?";
    case "pexels":
    case "giphy":
      return "I had trouble scouting the right footage or GIF — mind trying again?";
    default:
      return "Hit a snag assembling the video — mind trying again?";
  }
}

function payload(input: ApiErrorPayload): ApiErrorPayload {
  return input;
}
