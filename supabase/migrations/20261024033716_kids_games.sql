-- Three kids' party games: Bubble Pop, Guess the Animal Sound and Photo
-- Memory Match (features/games/*). They're solo, timed games like Word
-- Search, so they reuse game_attempts; `score` holds points (Bubble Pop,
-- Animal Sounds) or moves (Memory Match). Additive: existing games and
-- attempts are unchanged.

alter table public.event_games drop constraint if exists event_games_type_check;
alter table public.event_games add constraint event_games_type_check
  check (type in ('word_search', 'housie', 'movie_housie', 'bubble_pop', 'animal_sounds', 'memory_match'));

alter table public.game_attempts add column if not exists score integer;
