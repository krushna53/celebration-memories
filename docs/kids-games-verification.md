# Kids games verification — 24 October 2026

Applied `kids_games` to Supabase project `ktbpnjrovzhjwardyime` (celebration-memories). Supabase assigned migration version `20261024033716`; the local file was renamed to match that recorded version. Verified the six-type constraint, integer score column, and existing RLS on both game tables.

Browser checks used the current local Next.js app at localhost:3000 against the live Supabase database. No application deployment was performed. QA games were created only on the public demo-birthday-aanya-30 event with fictional player details, then their links were paused. Test records are retained for review.

- Bubble Pop: correct tap added one point; wrong-number tap added none. Timer ended at 45 seconds. Scoreboard saved 1 point. Replay started a fresh attempt and saved 0 points at 45 seconds; scoreboard ranked 1 before 0. Next player cleared the identity fields.
- Animal Sounds: completed eight rounds with one deliberate wrong answer, checked corrective feedback, replay-sound control and text hint. Final scoreboard showed 7/8 in 105 seconds. No captured browser console errors. Synthesized audio playback quality was not audibly assessed.
- Memory Match: gallery photos rendered, mismatch flipped back, matching cards remained revealed, all three pairs completed in four moves and 73 seconds. Saved scoreboard matched the result.
- Direct database read confirmed all four completed attempts and their displayed scores/durations.

QA game IDs: bubble_pop 966944cf-7a85-4868-ba69-3cd0fa966b06; animal_sounds 2bee993a-a1b9-4842-beef-4694e344fcc0; memory_match 8f6f8b31-2e62-425f-b7db-78e010cc437a.

Admin creation/settings UI was not exercised in this browser session because no admin session was available. Phone-device audio and responsive checks remain outside these desktop gameplay checks.

Supabase advisors reported informational RLS-without-policy findings consistent with the existing server-only access model, plus unrelated existing warnings for the public http extension, callable security-definer functions, and leaked-password protection. This migration does not modify those objects or settings.
