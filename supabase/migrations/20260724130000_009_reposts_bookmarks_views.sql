/*
# Reposts, Bookmarks & View Counts

## Overview
Extends the social feed so the post action bar can match X/Twitter's
five-icon layout exactly: comment, repost, like, view count, bookmark + share.

## New Tables
- reposts — a "retweet" on a post (unique per user+post), denormalized onto
  posts.repost_count via triggers, same pattern as likes.
- bookmarks — a private save on a post (unique per user+post). Unlike likes/
  reposts this is NOT publicly readable — only the owner can see their own
  bookmarks, matching X's private bookmark behavior.

## Changed Tables
- posts — adds repost_count (denormalized, public) and view_count
  (impression counter, public) columns.

## Functions
- sync_post_repost_count / dec_post_repost_count — keep posts.repost_count
  in sync with the reposts table, mirroring the existing like-count triggers.
- increment_post_view(post_id) — atomically bumps posts.view_count by 1.
  Callable by anon + authenticated; the client is responsible for only
  calling it once per viewer per session (see sessionStorage dedupe in the
  feed page) so a page full of refreshes doesn't inflate the counter.
*/

-- POSTS: new counters
ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_count int NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0;

-- REPOSTS
CREATE TABLE IF NOT EXISTS reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reposts_read_all" ON reposts;
CREATE POLICY "reposts_read_all" ON reposts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "reposts_insert_self" ON reposts;
CREATE POLICY "reposts_insert_self" ON reposts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reposts_delete_self" ON reposts;
CREATE POLICY "reposts_delete_self" ON reposts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS reposts_post_id_idx ON reposts (post_id);

-- BOOKMARKS (private — only visible to the owner)
CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bookmarks_read_own" ON bookmarks;
CREATE POLICY "bookmarks_read_own" ON bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "bookmarks_insert_self" ON bookmarks;
CREATE POLICY "bookmarks_insert_self" ON bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "bookmarks_delete_self" ON bookmarks;
CREATE POLICY "bookmarks_delete_self" ON bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx ON bookmarks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookmarks_post_id_idx ON bookmarks (post_id);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION sync_post_repost_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE posts SET repost_count = (SELECT count(*) FROM reposts WHERE post_id = NEW.post_id) WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION dec_post_repost_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE posts SET repost_count = (SELECT count(*) FROM reposts WHERE post_id = OLD.post_id) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION increment_post_view(target_post_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE posts SET view_count = view_count + 1 WHERE id = target_post_id;
END;
$$;

-- TRIGGERS
DROP TRIGGER IF EXISTS reposts_insert_count ON reposts;
CREATE TRIGGER reposts_insert_count AFTER INSERT ON reposts FOR EACH ROW EXECUTE FUNCTION sync_post_repost_count();
DROP TRIGGER IF EXISTS reposts_delete_count ON reposts;
CREATE TRIGGER reposts_delete_count AFTER DELETE ON reposts FOR EACH ROW EXECUTE FUNCTION dec_post_repost_count();
