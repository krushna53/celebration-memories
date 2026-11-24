-- Biography: a family occasion whose whole event page is a life story —
-- a book-cover hero, the life timeline, and a "Read the Book" reader
-- (/events/<slug>/book) typeset like a bestselling biography. Built in the
-- wizard's two Biography steps (story + photos, then the AI-written book);
-- the narrated film stays optional, from /admin/life-story.
alter type event_category add value if not exists 'biography';

-- Front matter + chapter epigraphs for the bestseller layout. Epigraphs are
-- only ever quotes the family's own story contains (or left empty).
alter table public.life_stories add column if not exists dedication text not null default '';
alter table public.life_story_chapters add column if not exists epigraph text not null default '';
alter table public.life_story_chapters add column if not exists epigraph_source text not null default '';
