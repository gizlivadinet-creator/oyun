/*
# Initial Schema — Social Interaction Game

## Overview
Creates the full production schema for a social interaction game with gamification
(XP, levels, coins, badges, missions, leaderboards). All tables use Row Level
Security. Social content is publicly readable; writes are owner-scoped.

## New Tables
- profiles — public user profile linked to auth.users (level, xp, coins, streak, role).
- follows — directed follow relationships.
- posts — user-authored posts with denormalized like/comment counts.
- likes — a like on a post (unique per user+post).
- comments — comments on a post.
- notifications — in-app notifications.
- missions — catalog of daily/weekly missions with rewards.
- user_missions — progress per user per mission per period.
- badges — catalog of achievement badges.
- user_badges — earned badges per user.

## Security
- RLS on every table.
- Social content readable by anon + authenticated.
- Writes owner-scoped via auth.uid().
- Admin-only writes on missions/badges catalogs.
- Owner columns default to auth.uid().

## XP / Level
- XP stored on profiles.xp; level derived as 1 + floor(sqrt(xp)/20).
- Triggers award +10 XP on post, +5 XP on comment.
- Counter triggers keep like_count/comment_count in sync.
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  username text UNIQUE,
  avatar_url text,
  bio text DEFAULT '',
  level int NOT NULL DEFAULT 1,
  xp int NOT NULL DEFAULT 0,
  coins int NOT NULL DEFAULT 0,
  streak int NOT NULL DEFAULT 0,
  last_login_date date,
  frame text DEFAULT 'default',
  is_premium boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  country text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_self" ON profiles;
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- FOLLOWS
CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_read_all" ON follows;
CREATE POLICY "follows_read_all" ON follows FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "follows_insert_self" ON follows;
CREATE POLICY "follows_insert_self" ON follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS "follows_delete_self" ON follows;
CREATE POLICY "follows_delete_self" ON follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- POSTS
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  media_url text,
  like_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_read_all" ON posts;
CREATE POLICY "posts_read_all" ON posts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "posts_insert_self" ON posts;
CREATE POLICY "posts_insert_self" ON posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "posts_update_self" ON posts;
CREATE POLICY "posts_update_self" ON posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "posts_delete_self" ON posts;
CREATE POLICY "posts_delete_self" ON posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts (user_id);

-- LIKES
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes_read_all" ON likes;
CREATE POLICY "likes_read_all" ON likes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "likes_insert_self" ON likes;
CREATE POLICY "likes_insert_self" ON likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "likes_delete_self" ON likes;
CREATE POLICY "likes_delete_self" ON likes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS likes_post_id_idx ON likes (post_id);

-- COMMENTS
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_read_all" ON comments;
CREATE POLICY "comments_read_all" ON comments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "comments_insert_self" ON comments;
CREATE POLICY "comments_insert_self" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comments_update_self" ON comments;
CREATE POLICY "comments_update_self" ON comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comments_delete_self" ON comments;
CREATE POLICY "comments_delete_self" ON comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments (post_id, created_at);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('follow','like','comment','badge','levelup','system')),
  body text NOT NULL DEFAULT '',
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_read_own" ON notifications;
CREATE POLICY "notifications_read_own" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_insert_self" ON notifications;
CREATE POLICY "notifications_insert_self" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id, created_at DESC);

-- MISSIONS (catalog)
CREATE TABLE IF NOT EXISTS missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title_tr text NOT NULL,
  title_en text NOT NULL,
  description_tr text NOT NULL,
  description_en text NOT NULL,
  category text NOT NULL DEFAULT 'social' CHECK (category IN ('social','daily','weekly','seasonal','special')),
  target int NOT NULL DEFAULT 1 CHECK (target > 0),
  xp_reward int NOT NULL DEFAULT 10 CHECK (xp_reward >= 0),
  coin_reward int NOT NULL DEFAULT 5 CHECK (coin_reward >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "missions_read_all" ON missions;
CREATE POLICY "missions_read_all" ON missions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "missions_admin_insert" ON missions;
CREATE POLICY "missions_admin_insert" ON missions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "missions_admin_update" ON missions;
CREATE POLICY "missions_admin_update" ON missions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "missions_admin_delete" ON missions;
CREATE POLICY "missions_admin_delete" ON missions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- USER MISSIONS
CREATE TABLE IF NOT EXISTS user_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  progress int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  claimed boolean NOT NULL DEFAULT false,
  period_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id, period_key)
);
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_missions_read_own" ON user_missions;
CREATE POLICY "user_missions_read_own" ON user_missions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_missions_insert_own" ON user_missions;
CREATE POLICY "user_missions_insert_own" ON user_missions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_missions_update_own" ON user_missions;
CREATE POLICY "user_missions_update_own" ON user_missions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_missions_delete_own" ON user_missions;
CREATE POLICY "user_missions_delete_own" ON user_missions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS user_missions_user_period_idx ON user_missions (user_id, period_key);

-- BADGES (catalog)
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_tr text NOT NULL,
  name_en text NOT NULL,
  description_tr text NOT NULL,
  description_en text NOT NULL,
  icon text NOT NULL,
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum','diamond')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badges_read_all" ON badges;
CREATE POLICY "badges_read_all" ON badges FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "badges_admin_insert" ON badges;
CREATE POLICY "badges_admin_insert" ON badges FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "badges_admin_update" ON badges;
CREATE POLICY "badges_admin_update" ON badges FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "badges_admin_delete" ON badges;
CREATE POLICY "badges_admin_delete" ON badges FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- USER BADGES
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_badges_read_all" ON user_badges;
CREATE POLICY "user_badges_read_all" ON user_badges FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "user_badges_insert_own" ON user_badges;
CREATE POLICY "user_badges_insert_own" ON user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_badges_delete_own" ON user_badges;
CREATE POLICY "user_badges_delete_own" ON user_badges FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION bump_xp(target_uid uuid, amount int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET xp = xp + amount, level = GREATEST(1, 1 + FLOOR(SQRT(GREATEST(xp + amount, 0)) / 20)::int), updated_at = now() WHERE id = target_uid;
END;
$$;

CREATE OR REPLACE FUNCTION sync_post_like_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE posts SET like_count = (SELECT count(*) FROM likes WHERE post_id = NEW.post_id) WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION dec_post_like_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE posts SET like_count = (SELECT count(*) FROM likes WHERE post_id = OLD.post_id) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION sync_post_comment_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE posts SET comment_count = (SELECT count(*) FROM comments WHERE post_id = NEW.post_id) WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION dec_post_comment_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE posts SET comment_count = (SELECT count(*) FROM comments WHERE post_id = OLD.post_id) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION award_post_xp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM bump_xp(NEW.user_id, 10);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION award_comment_xp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM bump_xp(NEW.user_id, 5);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- TRIGGERS
DROP TRIGGER IF EXISTS likes_insert_count ON likes;
CREATE TRIGGER likes_insert_count AFTER INSERT ON likes FOR EACH ROW EXECUTE FUNCTION sync_post_like_count();
DROP TRIGGER IF EXISTS likes_delete_count ON likes;
CREATE TRIGGER likes_delete_count AFTER DELETE ON likes FOR EACH ROW EXECUTE FUNCTION dec_post_like_count();
DROP TRIGGER IF EXISTS comments_insert_count ON comments;
CREATE TRIGGER comments_insert_count AFTER INSERT OR UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION sync_post_comment_count();
DROP TRIGGER IF EXISTS comments_delete_count ON comments;
CREATE TRIGGER comments_delete_count AFTER DELETE ON comments FOR EACH ROW EXECUTE FUNCTION dec_post_comment_count();
DROP TRIGGER IF EXISTS posts_xp_trigger ON posts;
CREATE TRIGGER posts_xp_trigger AFTER INSERT ON posts FOR EACH ROW EXECUTE FUNCTION award_post_xp();
DROP TRIGGER IF EXISTS comments_xp_trigger ON comments;
CREATE TRIGGER comments_xp_trigger AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION award_comment_xp();
DROP TRIGGER IF EXISTS profiles_touch ON profiles;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS user_missions_touch ON user_missions;
CREATE TRIGGER user_missions_touch BEFORE UPDATE ON user_missions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- SEED MISSIONS
INSERT INTO missions (code, title_tr, title_en, description_tr, description_en, category, target, xp_reward, coin_reward) VALUES
  ('daily_post', 'Günlük Gönderi', 'Daily Post', 'Bugün bir gönderi paylaş', 'Share a post today', 'daily', 1, 20, 10),
  ('daily_comment', 'Sosyal Kelebek', 'Social Butterfly', '3 gönderiye yorum yap', 'Comment on 3 posts', 'daily', 3, 15, 8),
  ('daily_like', 'Kalp Atıcı', 'Heart Striker', '5 gönderiyi beğen', 'Like 5 posts', 'daily', 5, 10, 5),
  ('weekly_posts', 'Haftanın Sesi', 'Voice of the Week', 'Bu hafta 5 gönderi paylaş', 'Share 5 posts this week', 'weekly', 5, 80, 40),
  ('weekly_follow', 'Yeni Arkadaşlar', 'New Friends', '3 kişiyi takip et', 'Follow 3 people', 'weekly', 3, 60, 30)
ON CONFLICT (code) DO NOTHING;

-- SEED BADGES
INSERT INTO badges (code, name_tr, name_en, description_tr, description_en, icon, tier) VALUES
  ('first_post', 'İlk Adım', 'First Step', 'İlk gönderini paylaş', 'Share your first post', 'Footprints', 'bronze'),
  ('social_10', 'Sosyal 10', 'Social 10', '10 gönderi paylaş', 'Share 10 posts', 'MessageCircle', 'bronze'),
  ('liked_50', 'Popüler', 'Popular', 'Toplam 50 beğeni al', 'Receive 50 likes total', 'Heart', 'silver'),
  ('commenter', 'Konuşkan', 'Talkative', '20 yorum yap', 'Make 20 comments', 'MessageSquare', 'silver'),
  ('streak_7', 'Haftalık Seri', 'Weekly Streak', '7 gün üst üste giriş yap', 'Log in 7 days in a row', 'Flame', 'gold'),
  ('level_10', 'Yükseliş', 'Rising Star', '10. seviyeye ulaş', 'Reach level 10', 'TrendingUp', 'gold'),
  ('follow_25', 'Lider', 'Leader', '25 kişiyi takip et', 'Follow 25 people', 'Users', 'platinum'),
  ('verified_xp', 'Usta', 'Master', '5000 XP topla', 'Earn 5000 XP', 'Crown', 'diamond')
ON CONFLICT (code) DO NOTHING;
