/*
# Profile media (avatar + cover photo)

## Changes
- Adds profiles.cover_url column for the profile cover/banner image.
- Creates a public "profile-media" storage bucket for avatar and cover images.
- RLS on storage.objects: anyone can read, but a user may only write into
  their own folder (profile-media/<uid>/...).

## Notes
Files are uploaded to paths like `<uid>/avatar.jpg` and `<uid>/cover.jpg`,
upserted on every change so old files are simply overwritten.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-media', 'profile-media', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

DROP POLICY IF EXISTS "profile_media_read_all" ON storage.objects;
CREATE POLICY "profile_media_read_all" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'profile-media');

DROP POLICY IF EXISTS "profile_media_owner_insert" ON storage.objects;
CREATE POLICY "profile_media_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "profile_media_owner_update" ON storage.objects;
CREATE POLICY "profile_media_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "profile_media_owner_delete" ON storage.objects;
CREATE POLICY "profile_media_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-media' AND (storage.foldername(name))[1] = auth.uid()::text);

NOTIFY pgrst, 'reload schema';
