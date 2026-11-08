-- Sacred Garden design videos (the opening video and the closing video) go to
-- the `gallery` bucket (services/uploads.ts's createSignedDesignMediaUpload).
-- Besides MP4 they may now be MOV (phones) or WebM (browser recordings), the
-- same video types as types/memory.ts's ACCEPTED_MIME_TYPES.video. Keep the
-- bucket's other MIME types and its visibility unchanged.
update storage.buckets
set allowed_mime_types = case
      when allowed_mime_types is null then null
      else array(select distinct unnest(allowed_mime_types || array['video/mp4', 'video/quicktime', 'video/webm']))
    end
where id = 'gallery';
