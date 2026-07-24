/*
# Fix profiles relationship for PostgREST embeds

## Problem
posts.user_id, comments.user_id and notifications.actor_id reference
auth.users(id) instead of profiles(id). Even though profiles.id also
references auth.users(id) (same values), PostgREST cannot infer a
relationship between posts/comments/notifications and profiles unless
there is a *direct* foreign key between those specific tables.

This breaks every embedded select in the app, e.g.:
  supabase.from('posts').select('*, author:profiles!posts_user_id_fkey(*)')
which fails with "Could not find a relationship between 'posts' and
'profiles' in the schema cache" — surfaced in the UI as a generic
"Bir hata oluştu" toast on the feed, comments and notifications.

## Fix
Re-point the foreign keys at profiles(id) instead of auth.users(id),
keeping the same constraint names so the existing !fkey hints in the
client code keep working. Safe because every authenticated user in
this app always has a profiles row before they can post/comment
(enforced by onboarding flow), so profiles.id covers the same values
as auth.users.id for all rows currently referencing user_id/actor_id.
*/

-- POSTS.user_id -> profiles.id
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE posts
  ADD CONSTRAINT posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- COMMENTS.user_id -> profiles.id
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE comments
  ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- NOTIFICATIONS.actor_id -> profiles.id (nullable, system notifications keep actor_id = null)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_actor_id_fkey;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Ask PostgREST to reload its schema cache so the new relationships
-- are picked up immediately without waiting for the next deploy.
NOTIFY pgrst, 'reload schema';
