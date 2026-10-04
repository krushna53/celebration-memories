-- Record the existing production Gallery settings for new installations.
-- Timeline attachments share this bucket. Keep its visibility and other MIME types unchanged.
update storage.buckets
set allowed_mime_types = case
      when allowed_mime_types is null then null
      else array(select distinct unnest(allowed_mime_types || array['video/mp4']))
    end,
    file_size_limit = case
      when file_size_limit is null then null
      else greatest(file_size_limit, 314572800)
    end
where id = 'gallery';
