-- Null falls back to existing single-song settings; [] explicitly disables music.
alter table public.events add column if not exists display_music_playlist jsonb;
alter table public.events add constraint events_display_music_playlist_check
  check (display_music_playlist is null or
    (jsonb_typeof(display_music_playlist) = 'array' and jsonb_array_length(display_music_playlist) <= 20));
