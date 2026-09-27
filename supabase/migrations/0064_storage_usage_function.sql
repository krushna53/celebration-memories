-- Storage usage for /admin/storage (2026-09-28): one query over
-- storage.objects instead of recursively listing a few hand-picked
-- folders, so EVERY stored byte is counted and categorised. Anything
-- with an unrecognised folder lands in 'other' (per event) rather than
-- disappearing from the totals.
--
-- Rows: event_id = first path segment when it's a UUID (per-event files);
-- NULL for platform-level files (RSVP form covers, platform assets,
-- marketplace/business uploads…), whose category is 'platform:<bucket>/<folder>'.
--
-- Read-only, SECURITY DEFINER (storage schema), executable by the
-- service role only — never by anon/authenticated browsers.

create or replace function public.storage_usage_by_event()
returns table (event_id uuid, category text, files bigint, bytes bigint)
language sql
stable
security definer
set search_path = public, storage
as $$
  with o as (
    select
      bucket_id,
      split_part(name, '/', 1) as seg1,
      split_part(name, '/', 2) as seg2,
      coalesce((metadata->>'size')::bigint, 0) as size,
      split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' as is_event
    from storage.objects
  )
  select
    case when is_event then seg1::uuid end as event_id,
    case
      when not is_event then 'platform:' || bucket_id || '/' || seg1
      when bucket_id = 'audio' and seg2 = 'slideshow-music' then 'slideshow'
      when bucket_id in ('photos', 'videos', 'audio') then 'memory_wall'
      when bucket_id = 'gallery' and seg2 in ('gallery', 'timeline') then 'gallery_timeline'
      when bucket_id = 'gallery' and seg2 in ('slideshow-video', 'timeline-movie') then 'slideshow'
      when bucket_id = 'gallery' and seg2 in ('ai-generated', 'ai-image-upload') then 'ai_images'
      when bucket_id = 'gallery' and seg2 in ('video-editor', 'video-editor-uploads') then 'video_editor'
      when bucket_id = 'gallery' and seg2 in ('share-image', 'share-video', 'highlight-reel') then 'share_display'
      else 'other'
    end as category,
    count(*)::bigint as files,
    sum(size)::bigint as bytes
  from o
  group by 1, 2;
$$;

revoke all on function public.storage_usage_by_event() from public, anon, authenticated;
grant execute on function public.storage_usage_by_event() to service_role;
