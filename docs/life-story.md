# Life Story — biography + AI film

`/admin/life-story` (owner + client hosts). The family gives us a story
(a Google Doc downloaded as .docx, or pasted text) and their photos; we
give back:

1. **A biography web page** — `/life-story/<shareToken>`, chapters with
   photos, the film at the top. Private until the host turns sharing on;
   never indexed.
2. **A printable PDF book** — A4, built in the browser with
   `@react-pdf/renderer` (`features/life-story/pdf-book.tsx`), so no
   server time limits.
3. **A narrated film** — 16:9 MP4 (720p): AI narration over the photos
   with slow pan/zoom, captions and soft music; up to 6 key photos are
   brought to life with **Grok Imagine** (xAI image-to-video).

## Flow

| Step | Where | What happens |
|---|---|---|
| Story | `story-panel.tsx` | .docx text extracted in the browser (mammoth) — the file never reaches the server |
| Photos | `photos-panel.tsx` | Compressed to JPEG in the browser (HEIC too), PUT straight to `gallery/<eventId>/life-story/photos/` via signed upload URL |
| Write with AI | Edge Function `life-story` → `structure` | One OpenAI Responses call reads the story + every photo (low detail) → chapters, captions, years, film script, which photos to animate. Background task (`EdgeRuntime.waitUntil`), polled by the page |
| Edit | `chapters-panel.tsx`, `film-panel.tsx` | Everything is editable; "Rewrite with AI" replaces chapters + script |
| Make the film | `film_start` then `film_tick` (polled every 6 s) | Script snapshotted into `life_story_render_scenes` → OpenAI TTS per scene (PCM → WAV, exact durations) → Grok clips submitted → clips copied into `videos` → Shotstack edit built (`edit.ts`) → MP4 copied into `videos` |
| Share | `share-panel.tsx` | Toggle + resettable link + WhatsApp |

Render states: `preparing → animating → submitting → rendering → done | error`.
The `animating → submitting` flip is a conditional update, so concurrent polls
send the Shotstack render exactly once. A Grok clip that fails, is held back by
moderation, or is still pending after 40 minutes falls back to pan/zoom — one
bad clip never sinks the film.

## Security

- Only the Next.js server calls the Edge Function, with the service-role key
  (after `requireAdminForEvent` + quota checks). It's deployed with JWT
  verification ON — the gateway checks the signature, then the function
  requires the `service_role` claim; any other caller gets 401.
- The function never takes a URL or script from the caller — it re-reads the
  database and signs every media URL itself.
- `services/media-access.ts` lets an anonymous visitor read
  `<eventId>/life-story/…` files **only** while the story is shared and the file
  is one of its photos or its finished film.
- Client-role caps per event: `life_stories.structure_limit` (default 5 AI
  writing runs) and `film_render_limit` (default 3 films). The owner is exempt.
  Raise with SQL, e.g.
  `update life_stories set film_render_limit = 6 where event_id = '…';`

## Setup

```bash
supabase db push            # migration 20261124150000_life_story.sql
supabase functions deploy life-story
supabase secrets set XAI_API_KEY=xai-...          # optional — without it every scene uses pan/zoom
```

Already-set secrets it reuses: `OPENAI_API_KEY`, `SHOTSTACK_API_KEY`,
`SHOTSTACK_ENV`. Optional: `OPENAI_TEXT_MODEL` (default `gpt-5.6-luna`),
`OPENAI_TTS_MODEL` (`gpt-4o-mini-tts`), `LIFE_STORY_TTS_VOICE` (`sage`),
`XAI_VIDEO_MODEL` (`grok-imagine-video-1.5-lite`), `XAI_VIDEO_RESOLUTION`
(`720p`), `LIFE_STORY_MAX_ANIMATED_SCENES` (`6`, keep in sync with
`LIFE_STORY_MAX_ANIMATED` in `lib/life-story.ts`).

## Cost per film (estimate, Nov 2026 list prices)

| Part | Typical | Cost |
|---|---|---|
| AI writing (story + 40 photos) | 1 call | ~$0.05–0.15 |
| Narration | ~2,500 characters | ~$0.03 |
| Grok Imagine, lite, 6 clips × ~7 s | 42 s | ~$0.85 (1.5-lite @ $0.02/s) |
| Shotstack render, ~3 min | 3 min | per your Shotstack plan |

So roughly ₹80–100 plus Shotstack minutes. `life_story_renders.xai_cost_usd`
records the real Grok cost reported by xAI for each render.

## Not built yet

- Importing photos already in the event Gallery (today they're uploaded again).
- A vertical 9:16 cut of the film for Instagram/WhatsApp Status.
- Picking the narrator's voice in the UI (one env-configured voice today).
- Google Docs import by link (download as .docx instead).
