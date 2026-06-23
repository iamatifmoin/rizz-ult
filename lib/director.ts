import { CLAUDE_MODEL, extractJson, getAnthropic, textFromMessage } from "./anthropic";

export type AudioMood = "hype" | "chaotic" | "wholesome" | "dramatic" | "deadpan";
export type GifTiming = "end" | "middle";

export interface DirectorPlan {
  hook_caption: string;
  pexels_query: string;
  giphy_query: string;
  gif_timing: GifTiming;
  audio_mood: AudioMood;
  duration_seconds: number;
}

const SYSTEM_PROMPT = `You are a Gen-Z social media creative director, NOT a copywriter. You plan short, funny, UGC-style marketing videos that feel like a meme a friend made — never like an ad.

You will be given a product (from the user's message and, when available, scraped page text). Output a plan for a 7-second vertical video that an automated pipeline will assemble from REAL fetched assets: a REAL, HUMAN-FREE Pexels stock clip (real footage of places/objects/scenes related to the product) in the background, a SUITABLE REAL MEME GIF overlaid large on top, a burned-in caption, and a local audio track. You are not generating video — you are choosing the ingredients and the joke.

Rules:
- hook_caption: max ~9 words. Write it the way a funny TikTok caption reads (lowercase energy, relatable, slightly unhinged), NOT the way ad copy reads. IMPORTANT: plain ASCII only — no emojis, no hashtags, no curly quotes, no em-dashes, no special/unicode characters of any kind. Use a straight apostrophe (') if needed. No product name stuffing.
- pexels_query: 2-4 words describing REAL footage of a place, object, or scene that is RELATED to the product but contains NO people (e.g. for a calorie app "fresh vegetables closeup"; for a fintech app "city street traffic"; for a project tool "modern empty office"; for a sleep app "rainy window night"). NOT abstract colors, NOT gradients, NOT shapes — real-world b-roll. NO humans in frame. This is the deadpan straight-man backdrop.
- giphy_query: 2-5 words naming a SUITABLE MEME that lands the joke. Pick whatever fits best: a well-known meme format featuring real people (e.g. "distracted boyfriend meme", "woman yelling at cat", "man sweating two buttons", "guy looking back meme", "kombucha girl reaction", "leonardo dicaprio pointing", "michael jordan crying meme", "side eye chloe") OR a real-person reaction/expression ("man shocked staring", "guy mind blown"). It MUST be real people — do NOT use cartoons, anime, pikachu, "this is fine" dog, or any animated/illustrated characters. Choose the meme that best matches the specific punchline of THIS product's joke, not a generic one. This is the EMOTIONAL PUNCHLINE, not the product category.
- Aim for INCONGRUITY between the calm real-world background and the chaotic human reaction + caption. That tension is what makes UGC memes funny.
- gif_timing: "end" to land the reaction as a punchline in the last few seconds, "middle" to ride it the whole way.
- audio_mood: one of hype | chaotic | wholesome | dramatic | deadpan — pick the one that amplifies the joke's tone.
- duration_seconds: 7.

Output STRICT JSON ONLY. No markdown fences. No preamble. No trailing commentary.

Examples:

Product: "Mint — a budgeting app that auto-categorizes your spending."
{"hook_caption":"me checking how i spent $400 on snacks","pexels_query":"grocery store shelves","giphy_query":"kombucha girl reaction","gif_timing":"middle","audio_mood":"deadpan","duration_seconds":7}

Product: "GlowDrops — a vitamin C serum for brighter skin in 2 weeks."
{"hook_caption":"day 3 and i already think i'm that girl","pexels_query":"water droplets closeup","giphy_query":"leonardo dicaprio pointing","gif_timing":"middle","audio_mood":"hype","duration_seconds":7}

Product: "Linear — issue tracking and project management for software teams."
{"hook_caption":"watching my backlog finally make sense","pexels_query":"modern empty office","giphy_query":"guy looking back meme","gif_timing":"end","audio_mood":"dramatic","duration_seconds":7}`;

export async function directVideo(input: {
  userMessage: string;
  scrapedContent: string;
}): Promise<DirectorPlan> {
  const anthropic = getAnthropic();

  const userBlock = [
    `User message: ${input.userMessage}`,
    input.scrapedContent
      ? `Scraped page content:\n${input.scrapedContent}`
      : "No page content was available — work from the user's message alone.",
    "",
    "Plan the video. Return STRICT JSON only.",
  ].join("\n");

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    temperature: 1,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userBlock }],
  });

  const plan = extractJson<DirectorPlan>(textFromMessage(response));
  return normalizePlan(plan);
}

const VALID_MOODS: AudioMood[] = ["hype", "chaotic", "wholesome", "dramatic", "deadpan"];

function normalizePlan(plan: Partial<DirectorPlan>): DirectorPlan {
  const duration = clamp(Number(plan.duration_seconds) || 7, 5, 10);
  return {
    hook_caption: (plan.hook_caption || "wait this is actually kind of genius").trim(),
    pexels_query: (plan.pexels_query || "city street traffic").trim(),
    giphy_query: (plan.giphy_query || "man shocked reaction").trim(),
    gif_timing: plan.gif_timing === "middle" ? "middle" : "end",
    audio_mood: VALID_MOODS.includes(plan.audio_mood as AudioMood)
      ? (plan.audio_mood as AudioMood)
      : "hype",
    duration_seconds: duration,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
