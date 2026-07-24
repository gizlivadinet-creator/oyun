/*
# Embedded media links (YouTube, Vimeo, Dailymotion, Facebook, Instagram, TikTok)

## Changes
- Widens the posts.media_type CHECK constraint to also allow 'embed', so a
  post can carry a plain URL to a third-party video (rendered client-side as
  a sandboxed iframe) instead of only an uploaded file.
- No storage changes needed here: embed posts never touch Supabase Storage,
  they just store the original URL the user pasted in media_url.

## Notes
This is purely additive and backward compatible — existing 'image' and
'video' rows are untouched.
*/

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_media_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_media_type_check
  CHECK (media_type IN ('image', 'video', 'embed'));

NOTIFY pgrst, 'reload schema';
