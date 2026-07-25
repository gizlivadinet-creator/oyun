/*
# Notifications, combined feed & bookmarks fix

## Problem
1. The `notifications` table existed but nothing ever inserted a row into it —
   no trigger fired on like/comment/follow/repost/new-post, so the bell icon
   and the notifications page were permanently empty.
2. The main feed only ever queried `posts` ordered by `created_at`, so a
   repost never appeared in anyone's timeline and reposted posts were
   indistinguishable from the reposter's own posts on their profile.
3. Bookmarks had no read path wired to a screen.
4. `profiles.username` was only unique on exact byte match, so "Hamdi" and
   "hamdi" could both be registered, producing colliding /u/ URLs.

## Fix
- Widen notifications.type to also allow 'repost' and 'post'.
- SECURITY DEFINER trigger functions that insert a notification for like,
  comment, follow and repost events (skipping self-notifications), and
  clean the notification back up when the underlying action is undone
  (unlike / unfollow / unrepost) so the bell never shows stale state.
- A trigger on posts that fans out a lightweight 'post' notification to the
  author's followers.
- A case-insensitive unique index on profiles.username so slugs never
  collide regardless of case.
- get_feed(limit, offset) / get_user_feed(user_id, limit, offset): SQL
  functions that return posts *and* reposts merged into one activity-ordered
  timeline, each row tagged with the reposting actor (if any), so the client
  can render the "X reposted" banner and keep the profile timeline in sync
  with reposts. Both are callable by anon so the public feed keeps working
  for signed-out visitors.
- Realtime: make sure notifications is part of the supabase_realtime
  publication so the client can subscribe instead of polling.

## Hardening
Every new SECURITY DEFINER function sets `search_path = public` (matching
this project's existing convention, see e.g. bump_xp / increment_post_view)
to avoid search_path hijacking. The eight notification trigger functions
(notify_on_*/unnotify_on_*) are internal-only — they only ever run as
trigger bodies fired by INSERT/DELETE on likes/comments/follows/reposts/
posts — so EXECUTE is revoked from `anon`/`authenticated` (see migration
011) exactly like the project's other trigger helpers (sync_post_like_count,
bump_xp, etc). get_feed/get_user_feed ARE meant to be called directly by the
client (anon included, for the public feed), so EXECUTE stays granted to
anon/authenticated/service_role — the same accepted pattern already used by
increment_post_view.
*/

-- ---------------------------------------------------------------------
-- 1. Widen notification types
-- ---------------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('follow','like','comment','repost','post','badge','levelup','system'));

-- ---------------------------------------------------------------------
-- 2. Case-insensitive unique usernames (fixes /u/hamdi vs /u/Hamdi clash)
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON profiles (lower(username));

-- ---------------------------------------------------------------------
-- 3. Notification triggers
-- ---------------------------------------------------------------------

-- LIKES -> notify post owner
CREATE OR REPLACE FUNCTION notify_on_like() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  post_owner uuid;
BEGIN
  SELECT user_id INTO post_owner FROM posts WHERE id = NEW.post_id;
  IF post_owner IS NOT NULL AND post_owner <> NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, body, link)
    VALUES (post_owner, NEW.user_id, 'like', '', '/post/' || NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION notify_on_like() FROM PUBLIC;

CREATE OR REPLACE FUNCTION unnotify_on_unlike() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  post_owner uuid;
BEGIN
  SELECT user_id INTO post_owner FROM posts WHERE id = OLD.post_id;
  IF post_owner IS NOT NULL THEN
    DELETE FROM notifications
    WHERE user_id = post_owner AND actor_id = OLD.user_id AND type = 'like'
      AND link = '/post/' || OLD.post_id AND read = false;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION unnotify_on_unlike() FROM PUBLIC;

DROP TRIGGER IF EXISTS likes_notify ON likes;
CREATE TRIGGER likes_notify AFTER INSERT ON likes FOR EACH ROW EXECUTE FUNCTION notify_on_like();
DROP TRIGGER IF EXISTS likes_unnotify ON likes;
CREATE TRIGGER likes_unnotify AFTER DELETE ON likes FOR EACH ROW EXECUTE FUNCTION unnotify_on_unlike();

-- COMMENTS -> notify post owner
CREATE OR REPLACE FUNCTION notify_on_comment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  post_owner uuid;
BEGIN
  SELECT user_id INTO post_owner FROM posts WHERE id = NEW.post_id;
  IF post_owner IS NOT NULL AND post_owner <> NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, body, link)
    VALUES (post_owner, NEW.user_id, 'comment', left(NEW.body, 120), '/post/' || NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION notify_on_comment() FROM PUBLIC;

DROP TRIGGER IF EXISTS comments_notify ON comments;
CREATE TRIGGER comments_notify AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

-- FOLLOWS -> notify followed user
CREATE OR REPLACE FUNCTION notify_on_follow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.followed_id <> NEW.follower_id THEN
    INSERT INTO notifications (user_id, actor_id, type, body, link)
    VALUES (NEW.followed_id, NEW.follower_id, 'follow', '', '/u/' || NEW.follower_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION notify_on_follow() FROM PUBLIC;

CREATE OR REPLACE FUNCTION unnotify_on_unfollow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM notifications
  WHERE user_id = OLD.followed_id AND actor_id = OLD.follower_id AND type = 'follow' AND read = false;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION unnotify_on_unfollow() FROM PUBLIC;

DROP TRIGGER IF EXISTS follows_notify ON follows;
CREATE TRIGGER follows_notify AFTER INSERT ON follows FOR EACH ROW EXECUTE FUNCTION notify_on_follow();
DROP TRIGGER IF EXISTS follows_unnotify ON follows;
CREATE TRIGGER follows_unnotify AFTER DELETE ON follows FOR EACH ROW EXECUTE FUNCTION unnotify_on_unfollow();

-- REPOSTS -> notify post owner
CREATE OR REPLACE FUNCTION notify_on_repost() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  post_owner uuid;
BEGIN
  SELECT user_id INTO post_owner FROM posts WHERE id = NEW.post_id;
  IF post_owner IS NOT NULL AND post_owner <> NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, body, link)
    VALUES (post_owner, NEW.user_id, 'repost', '', '/post/' || NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION notify_on_repost() FROM PUBLIC;

CREATE OR REPLACE FUNCTION unnotify_on_unrepost() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  post_owner uuid;
BEGIN
  SELECT user_id INTO post_owner FROM posts WHERE id = OLD.post_id;
  IF post_owner IS NOT NULL THEN
    DELETE FROM notifications
    WHERE user_id = post_owner AND actor_id = OLD.user_id AND type = 'repost'
      AND link = '/post/' || OLD.post_id AND read = false;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION unnotify_on_unrepost() FROM PUBLIC;

DROP TRIGGER IF EXISTS reposts_notify ON reposts;
CREATE TRIGGER reposts_notify AFTER INSERT ON reposts FOR EACH ROW EXECUTE FUNCTION notify_on_repost();
DROP TRIGGER IF EXISTS reposts_unnotify ON reposts;
CREATE TRIGGER reposts_unnotify AFTER DELETE ON reposts FOR EACH ROW EXECUTE FUNCTION unnotify_on_unrepost();

-- NEW POST -> fan out to followers ("takip ettiğin biri paylaştı")
CREATE OR REPLACE FUNCTION notify_on_new_post() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type, body, link)
  SELECT f.follower_id, NEW.user_id, 'post', left(NEW.body, 120), '/post/' || NEW.id
  FROM follows f
  WHERE f.followed_id = NEW.user_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION notify_on_new_post() FROM PUBLIC;

DROP TRIGGER IF EXISTS posts_notify_followers ON posts;
CREATE TRIGGER posts_notify_followers AFTER INSERT ON posts FOR EACH ROW EXECUTE FUNCTION notify_on_new_post();

-- ---------------------------------------------------------------------
-- 4. Combined feed (posts + reposts) RPCs — client-callable, so EXECUTE
--    is explicitly granted to anon/authenticated/service_role after the
--    blanket PUBLIC revoke (mirrors increment_post_view's grant pattern).
-- ---------------------------------------------------------------------

-- Global timeline: every post and every repost across the whole app,
-- ordered by the moment it entered the timeline (post creation OR the
-- repost's created_at), newest first. Anonymous-safe.
CREATE OR REPLACE FUNCTION get_feed(p_limit int DEFAULT 10, p_offset int DEFAULT 0)
RETURNS TABLE (
  item_id text,
  activity_at timestamptz,
  kind text,
  reposted_by jsonb,
  post jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT item_id, activity_at, kind, reposted_by, post FROM (
    SELECT
      p.id::text || ':post' AS item_id,
      p.created_at AS activity_at,
      'post'::text AS kind,
      NULL::jsonb AS reposted_by,
      to_jsonb(p) || jsonb_build_object('author', to_jsonb(pr)) AS post
    FROM posts p
    JOIN profiles pr ON pr.id = p.user_id
    UNION ALL
    SELECT
      r.post_id::text || ':repost:' || r.id::text AS item_id,
      r.created_at AS activity_at,
      'repost'::text AS kind,
      to_jsonb(rp) AS reposted_by,
      to_jsonb(p) || jsonb_build_object('author', to_jsonb(pr)) AS post
    FROM reposts r
    JOIN posts p ON p.id = r.post_id
    JOIN profiles pr ON pr.id = p.user_id
    JOIN profiles rp ON rp.id = r.user_id
  ) combined
  ORDER BY activity_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
REVOKE EXECUTE ON FUNCTION get_feed(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_feed(int, int) TO anon, authenticated, service_role;

-- Per-profile timeline: a user's own posts + the posts they reposted,
-- ordered the same way, so a repost shows up in the right place on their
-- profile with a "reposted" banner instead of being invisible.
CREATE OR REPLACE FUNCTION get_user_feed(p_user_id uuid, p_limit int DEFAULT 20, p_offset int DEFAULT 0)
RETURNS TABLE (
  item_id text,
  activity_at timestamptz,
  kind text,
  reposted_by jsonb,
  post jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT item_id, activity_at, kind, reposted_by, post FROM (
    SELECT
      p.id::text || ':post' AS item_id,
      p.created_at AS activity_at,
      'post'::text AS kind,
      NULL::jsonb AS reposted_by,
      to_jsonb(p) || jsonb_build_object('author', to_jsonb(pr)) AS post
    FROM posts p
    JOIN profiles pr ON pr.id = p.user_id
    WHERE p.user_id = p_user_id
    UNION ALL
    SELECT
      r.post_id::text || ':repost:' || r.id::text AS item_id,
      r.created_at AS activity_at,
      'repost'::text AS kind,
      to_jsonb(rp) AS reposted_by,
      to_jsonb(p) || jsonb_build_object('author', to_jsonb(pr)) AS post
    FROM reposts r
    JOIN posts p ON p.id = r.post_id
    JOIN profiles pr ON pr.id = p.user_id
    JOIN profiles rp ON rp.id = r.user_id
    WHERE r.user_id = p_user_id
  ) combined
  ORDER BY activity_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
REVOKE EXECUTE ON FUNCTION get_user_feed(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_feed(uuid, int, int) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Realtime — make sure the tables the client subscribes to are part
--    of the publication (idempotent; safe to run repeatedly).
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
EXCEPTION WHEN undefined_object THEN
  -- supabase_realtime publication doesn't exist in this environment; skip.
  NULL;
END $$;

NOTIFY pgrst, 'reload schema';
