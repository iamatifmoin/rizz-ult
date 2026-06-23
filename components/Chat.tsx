"use client";

import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  videoUrl?: string;
  error?: boolean;
}

const DIRECTING_STEPS = [
  "Reading the product",
  "Scouting footage",
  "Picking the perfect GIF",
  "Cutting the final edit",
];

const SUGGESTIONS = [
  "I'm building CalAI, a calorie tracking app. calai.app",
  "Make a video for Notion - the all-in-one workspace. notion.so",
  "Hype up Duolingo, the language learning app. duolingo.com",
];

const TOP_BADGES = [
  "Real stock footage",
  "Fun, fast and viral",
];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [directing, setDirecting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, directing]);

  useEffect(() => {
    if (!directing) return;
    const t = setInterval(() => {
      setStepIndex((i) => (i + 1) % DIRECTING_STEPS.length);
    }, 2500);
    return () => clearInterval(t);
  }, [directing]);

  function addMessage(msg: Message) {
    setMessages((prev) => [...prev, msg]);
  }

  function updateMessage(id: string, patch: Partial<Message>) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setInput("");
    setBusy(true);
    addMessage({ id: uid(), role: "user", content: trimmed });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.type === "video_request") {
          await runVideo(trimmed, data.url ?? null);
        } else if (data.error) {
          addMessage({
            id: uid(),
            role: "assistant",
            content: data.error,
            error: true,
          });
        }
      } else {
        await streamText(res);
      }
    } catch {
      addMessage({
        id: uid(),
        role: "assistant",
        content: "Something went wrong reaching the server. Mind trying again?",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }

  async function streamText(res: Response) {
    const assistantId = uid();
    addMessage({ id: assistantId, role: "assistant", content: "" });

    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let acc = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      updateMessage(assistantId, { content: acc });
    }
  }

  async function runVideo(message: string, url: string | null) {
    setStepIndex(0);
    setDirecting(true);
    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, url }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        addMessage({
          id: uid(),
          role: "assistant",
          content:
            data.error || "Hit a snag assembling the video - mind trying again?",
          error: true,
        });
        return;
      }

      const lead = data.scrapeFailed
        ? "I couldn't fully load that page, but here's what I cooked up:"
        : "Here's your UGC cut:";

      addMessage({
        id: uid(),
        role: "assistant",
        content: `${lead}\n\"${data.caption}\"`,
        videoUrl: data.videoUrl,
      });
    } catch {
      addMessage({
        id: uid(),
        role: "assistant",
        content: "Hit a snag assembling the video - mind trying again?",
        error: true,
      });
    } finally {
      setDirecting(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-5rem] top-[-4rem] h-48 w-48 rounded-full bg-punch/20 blur-3xl sm:h-64 sm:w-64" />
        <div className="absolute right-[-4rem] top-20 h-44 w-44 rounded-full bg-sky/25 blur-3xl sm:h-56 sm:w-56" />
        <div className="absolute bottom-[-5rem] left-1/3 h-52 w-52 rounded-full bg-mint/20 blur-3xl sm:h-72 sm:w-72" />
      </div>

      <div className="relative mx-auto flex h-full w-full max-w-4xl flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/72 shadow-[0_16px_48px_rgba(60,35,15,0.12)] backdrop-blur-xl">
          <header className="border-b border-line/80 px-3 py-3 sm:px-4 sm:py-3.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
               
                <div className="mt-2">
                  <p className="font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-none text-foreground">
                    Rizz-ult
                  </p>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-ink-soft">
                    AI-directed UGC cuts. Get your product to go viral.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 lg:max-w-sm lg:justify-end">
                {TOP_BADGES.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-black/10 bg-paper px-2 py-1 text-[10px] font-medium text-foreground shadow-[0_2px_10px_rgba(23,18,15,0.04)]"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4">
              {empty && (
                <EmptyState
                  onPick={(s) => send(s)}
                  disabled={busy}
                />
              )}

              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}

              {directing && <DirectingBubble step={DIRECTING_STEPS[stepIndex]} />}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-line/80 bg-white/55 px-2 py-2 sm:px-3 sm:py-3"
          >
            <div className="mx-auto max-w-2xl">
              <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1 text-[9px] uppercase tracking-[0.2em] text-ink-soft">
                <span>Prompt</span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-foreground">
                  product
                </span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-foreground">
                  URL
                </span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-foreground">
                  desired vibe
                </span>
              </div>

              <div className="flex items-end gap-1.5 rounded-2xl border border-black/10 bg-[#fff8ee] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_20px_rgba(23,18,15,0.05)] sm:gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  placeholder="Drop the product, the link, and the lore..."
                  className="min-h-[40px] max-h-28 flex-1 resize-none bg-transparent px-3 py-2 text-[13px] leading-5 text-foreground outline-none placeholder:text-ink-soft/75"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-[#111111] px-3.5 text-xs font-medium text-white shadow-[0_8px_20px_rgba(17,17,17,0.18)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 sm:px-4"
                >
                  {busy ? "Cooking..." : "Send it"}
                </button>
              </div>

              <p className="mt-2 text-center text-[10px] leading-4 text-ink-soft">
                Videos are AI-organized, not AI-generated - Claude directs and ffmpeg assembles real stock, GIFs, and audio.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  onPick,
  disabled,
}: {
  onPick: (s: string) => void;
  disabled: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-2xl border border-black/10 bg-paper/80 px-4 py-5 text-center sm:px-6">
        <h1 className="font-display text-[clamp(1.5rem,4vw,2rem)] leading-tight text-foreground">
          Sell it like the timeline would.
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-ink-soft">
          Drop a product and URL. Get a short, viral UGC video.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {SUGGESTIONS.map((suggestion, index) => {
          const accents = [
            "bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,240,206,0.9))]",
            "bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(233,245,255,0.92))]",
            "bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(232,255,242,0.92))]",
          ];

          return (
            <button
              key={suggestion}
              disabled={disabled}
              onClick={() => onPick(suggestion)}
              className={`group flex h-full flex-col justify-between rounded-xl border border-black/10 p-3 text-left shadow-[0_8px_20px_rgba(23,18,15,0.05)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50 ${accents[index]}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-ink-soft">
                    Prompt 0{index + 1}
                  </span>
                  <span className="text-[10px] text-ink-soft">Tap to load</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-foreground">
                  {suggestion}
                </p>
              </div>
              <span className="mt-3 text-[10px] font-medium text-foreground transition group-hover:translate-x-1">
                Use this brief -&gt;
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const hasVideo = Boolean(message.videoUrl);
  const label = isUser
    ? "Brief received"
    : message.error
      ? "Heads up"
      : hasVideo
        ? "Render delivered"
        : "Creative director";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <article
        className={[
          "rounded-2xl border p-3 shadow-[0_10px_28px_rgba(23,18,15,0.06)]",
          hasVideo ? "w-fit max-w-sm" : "w-full max-w-md",
          isUser
            ? "border-black/10 bg-[linear-gradient(135deg,#ffd64e_0%,#ff8b6a_100%)] text-[#17120f]"
            : message.error
              ? "border-[#f3b7ae] bg-[#fff1ef] text-[#7a241c]"
              : hasVideo
                ? "border-black/10 bg-[#fffaf3] text-foreground"
                : "border-black/10 bg-white/90 text-foreground",
        ].join(" ")}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.2em]",
              isUser
                ? "bg-black/10 text-black/65"
                : message.error
                  ? "bg-[#f8cbc5] text-[#8f2f24]"
                  : "bg-black/5 text-ink-soft",
            ].join(" ")}
          >
            {label}
          </span>
        </div>

        {message.content && (
          <p className="whitespace-pre-wrap text-[13px] leading-5">
            {message.content}
          </p>
        )}

        {message.videoUrl && (
          <div className="mt-3 w-fit max-w-full overflow-hidden rounded-xl border border-black/10 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <video
              src={message.videoUrl}
              controls
              loop
              playsInline
              className="block max-h-[min(70vh,420px)] w-auto max-w-full rounded-[10px]"
            />
          </div>
        )}
      </article>
    </div>
  );
}

function DirectingBubble({ step }: { step: string }) {
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-[#fff6e7] p-3 shadow-[0_10px_28px_rgba(23,18,15,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111111]">
              <span className="flex gap-0.5">
                <Dot delay="0ms" />
                <Dot delay="150ms" />
                <Dot delay="300ms" />
              </span>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-ink-soft">
                In the edit bay
              </p>
              <p className="mt-0.5 text-xs font-medium text-foreground">
                Directing your video...
              </p>
            </div>
          </div>
          <span className="rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-ink-soft">
            Live render
          </span>
        </div>

        <div className="mt-2 rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-xs text-foreground">
          {step}
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ffd64e]"
      style={{ animationDelay: delay }}
    />
  );
}
