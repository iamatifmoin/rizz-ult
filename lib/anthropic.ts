import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared Anthropic client + model id.
 *
 * The key is read from the environment only. It is never logged or shipped to
 * the client (every consumer of this module runs server-side).
 */
export const CLAUDE_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Pull the first text block out of a Claude message response.
 */
export function textFromMessage(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/**
 * Claude sometimes wraps JSON in ```json fences or adds preamble despite
 * instructions. This pulls the first balanced JSON object out of a string.
 */
export function extractJson<T>(raw: string): T {
  const fenced = raw.replace(/```(?:json)?/gi, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object found in model output: ${raw.slice(0, 200)}`);
  }
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}
