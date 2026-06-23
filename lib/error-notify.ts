import type { ApiErrorPayload } from "@/lib/api-errors";
import type { ToastInput } from "@/components/Toast";

const SOURCE_LABELS: Record<ApiErrorPayload["errorSource"], string> = {
  anthropic: "Claude API",
  pexels: "Pexels",
  giphy: "Giphy",
  network: "Network",
  app: "Rizz-ult",
};

const KIND_LABELS: Partial<Record<ApiErrorPayload["errorKind"], string>> = {
  overloaded: "temporarily overloaded",
  rate_limit: "rate limited",
  billing: "billing issue",
  upstream: "unavailable",
  config: "misconfigured",
  internal: "error",
};

export function toastFromApiError(data: Partial<ApiErrorPayload>): ToastInput {
  const source = data.errorSource ?? "app";
  const kind = data.errorKind ?? "internal";
  const sourceLabel = SOURCE_LABELS[source];
  const kindLabel = KIND_LABELS[kind];

  const title =
    data.external && source !== "app"
      ? `${sourceLabel} ${kindLabel ?? "issue"}`
      : source === "app"
        ? "Something went wrong"
        : `${sourceLabel} issue`;

  return {
    title,
    message: data.error ?? "Something went wrong. Please try again.",
    variant: data.external ? "external" : "app",
  };
}

export function toastForNetworkFailure(): ToastInput {
  return {
    title: "Connection problem",
    message:
      "Couldn't reach the server. Check your internet and try again — this isn't a video-generation bug.",
    variant: "external",
  };
}
