-- Background music for the Big Screen Display (/events/[slug]/display).
-- display_music: a preset key from lib/reel-music.ts ("celebration",
-- "heartfelt", …), 'custom' for the host's own upload (display_music_path,
-- in the audio bucket), or null = no music (the default — existing
-- displays stay silent until the host picks a track).
alter table public.events
  add column if not exists display_music text,
  add column if not exists display_music_path text;
