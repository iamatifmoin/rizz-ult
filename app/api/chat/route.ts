import { NextRequest } from "next/server";
import { CLAUDE_MODEL, getAnthropic } from "@/lib/anthropic";
import { classifyIntent } from "@/lib/intent";

export const runtime = "nodejs";

const CHAT_SYSTEM_PROMPT =
  "You are the assistant inside a UGC video generator tool. Be warm, brief, and conversational like ChatGPT. " +
  "If asked what you can do, say something like: 'I can generate UGC videos for you! Just send me a product URL " +
  "and I'll create an engaging short-form marketing video.' Don't be salesy or robotic.";

export async function POST(req: NextRequest) {
  let message = "";
  try {
    const body = await req.json();
    message = typeof body?.message === "string" ? body.message : "";
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!message.trim()) {
    return Response.json({ error: "Empty message" }, { status: 400 });
  }

  const intent = await classifyIntent(message);

  // Video requests are handed back to the client, which then calls
  // /api/generate-video (the long-running job) and shows a progress state.
  if (intent.intent === "video_request") {
    return Response.json({ type: "video_request", url: intent.url });
  }

  // Casual chat: stream Claude's reply as plain text.
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const anthropic = getAnthropic();
        const claudeStream = anthropic.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 400,
          system: CHAT_SYSTEM_PROMPT,
          messages: [{ role: "user", content: message }],
        });

        claudeStream.on("text", (text) => {
          controller.enqueue(encoder.encode(text));
        });

        await claudeStream.finalMessage();
        controller.close();
      } catch {
        controller.enqueue(
          encoder.encode("Sorry, I hit a snag responding. Mind trying again?")
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
