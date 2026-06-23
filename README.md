# Rizz-ult — UGC video chatbot

Chat like ChatGPT. Paste a product + URL and it plans a short vertical video, fetches real stock footage and reaction GIFs, and assembles them with ffmpeg.

![Rizzult](/public/ss.png)

[Test it out- rizzult.vercel.app](https://rizzult.vercel.app/)

**The videos are AI-organized, not AI-generated.** Claude picks the caption, search terms, timing, and mood. ffmpeg composites a Pexels clip, Giphy reaction, and local audio into a ~7s 9:16 short.


## Quick start

```bash
npm install
cp .env.example .env.local   # add your keys
npm run dev
```

Open http://localhost:3000.

### API keys (`.env.local`)

| Variable | Get it from |
| --- | --- |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `PEXELS_API_KEY` | https://www.pexels.com/api/ |
| `GIPHY_API_KEY` | https://developers.giphy.com |

### ffmpeg

Must be on your `PATH` (`fluent-ffmpeg` shells out to it).

```bash
# macOS
brew install ffmpeg
# Linux
sudo apt install ffmpeg
# Windows
winget install Gyan.FFmpeg
```

Check with `ffmpeg -version`.

## How it works

1. **Chat** — casual messages stream back from Claude.
2. **Video request** — a URL or product-y message triggers `/api/generate-video`.
3. **Pipeline** — scrape the page → Claude plans caption/queries/mood (JSON) → fetch Pexels + Giphy assets → ffmpeg render → inline `<video>` in the thread.

Output lands in `public/videos/` and is served at `/videos/{uuid}.mp4`.

## Try it

Send: **"I'm building CalAI, a calorie tracking app. calai.app"** (suggestion chip on the empty screen).

You should get a playable vertical clip with caption, reaction GIF overlay, and audio. "hi" and other casual turns just chat.

## Notes

- Audio is mood-based local clips in `public/audio/` (Giphy GIFs are silent). Drop in your own `.mp3`s with the same filenames to upgrade.
- Video generation runs synchronously in the HTTP request (~10s). Fine for a demo; production would want a job queue.
- Scraping is plain `fetch` + HTML strip — thin results on JS-heavy sites are handled gracefully.
- No auth, DB, or persistence.
