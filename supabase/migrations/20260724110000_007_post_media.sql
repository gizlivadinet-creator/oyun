/*
# Post media (images + videos)

## Changes
- Adds posts.media_type column ('image' | 'video') alongside the existing
  posts.media_url column.
- Creates a public "post-media" storage bucket for post attachments.
- RLS on storage.objects: anyone can read, a user may only write into their
  own folder (post-media/<uid>/...), matching the profile-media pattern.
- Accepts a broad set of image and video mime types so users can attach
  virtually any common photo or video format (mp4, webm, ogg/ogv, mov,
  avi, mkv, 3gp, wmv, mpeg, HEIC, AVIF, etc).

## Notes
Files are uploaded to paths like `<uid>/<timestamp>-<filename>`. Unlike the
profile-media bucket these are not upserted onto a fixed filename, since a
user can have many posts, each with its own attachment.
*/

ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'video'));

-- The original schema required a non-empty body on every post. Now that
-- posts can carry an image/video attachment, allow an empty caption as
-- long as media is attached (a post must still have *something*).
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_body_check;
ALTER TABLE posts ALTER COLUMN body SET DEFAULT '';
ALTER TABLE posts ALTER COLUMN body DROP NOT NULL;
UPDATE posts SET body = '' WHERE body IS NULL;
ALTER TABLE posts ALTER COLUMN body SET NOT NULL;
ALTER TABLE posts ADD CONSTRAINT posts_body_check
  CHECK (
    char_length(body) <= 500
    AND (char_length(body) > 0 OR media_url IS NOT NULL)
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  104857600,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif','image/svg+xml',
    'video/mp4','video/webm','video/ogg','video/quicktime','video/x-msvideo','video/x-matroska',
    'video/3gpp','video/3gpp2','video/x-ms-wmv','video/mpeg','video/x-flv','video/mp2t'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif','image/svg+xml',
    'video/mp4','video/webm','video/ogg','video/quicktime','video/x-msvideo','video/x-matroska',
    'video/3gpp','video/3gpp2','video/x-ms-wmv','video/mpeg','video/x-flv','video/mp2t'
  ];

DROP POLICY IF EXISTS "post_media_read_all" ON storage.objects;
CREATE POLICY "post_media_read_all" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'post-media');

DROP POLICY IF EXISTS "post_media_owner_insert" ON storage.objects;
CREATE POLICY "post_media_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "post_media_owner_update" ON storage.objects;
CREATE POLICY "post_media_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "post_media_owner_delete" ON storage.objects;
CREATE POLICY "post_media_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

NOTIFY pgrst, 'reload schema';
