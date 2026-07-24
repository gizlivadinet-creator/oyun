import { supabase } from '@/lib/supabase';
import { todayKey, weekKey } from '@/lib/utils';
import type { Post, Profile, Mission, UserMission, Badge, MissionWithProgress } from '@/lib/types';

const PAGE_SIZE = 10;

export async function fetchFeed(page = 0): Promise<{ posts: Post[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, author:profiles!posts_user_id_fkey(*)')
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (error) throw error;
  const posts = (data ?? []) as unknown as Post[];
  const hasMore = posts.length > PAGE_SIZE;
  return { posts: posts.slice(0, PAGE_SIZE), hasMore };
}

export async function fetchLikedIds(postIds: string[], userId: string): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);
  if (error) throw error;
  return new Set((data ?? []).map((l) => l.post_id));
}

export async function createPost(
  body: string,
  userId: string,
  media?: { url: string; type: 'image' | 'video' | 'embed' } | null,
): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      body: body.trim(),
      user_id: userId,
      media_url: media?.url ?? null,
      media_type: media?.type ?? null,
    })
    .select('*, author:profiles!posts_user_id_fkey(*)')
    .single();
  if (error) throw error;
  return data as unknown as Post;
}

export async function uploadPostMedia(
  userId: string,
  file: File,
): Promise<{ url: string; type: 'image' | 'video' }> {
  const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
  const ext = file.name.split('.').pop()?.toLowerCase() || (type === 'video' ? 'mp4' : 'jpg');
  const safeExt = ext.replace(/[^a-z0-9]/gi, '') || (type === 'video' ? 'mp4' : 'jpg');
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  const { error } = await supabase.storage
    .from('post-media')
    .upload(path, file, { upsert: false, cacheControl: '3600', contentType: file.type || undefined });
  if (error) throw error;
  const { data } = supabase.storage.from('post-media').getPublicUrl(path);
  return { url: data.publicUrl, type };
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function toggleLike(postId: string, userId: string, liked: boolean): Promise<void> {
  if (liked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('likes')
      .insert({ post_id: postId, user_id: userId });
    if (error && error.code !== '23505') throw error;
  }
}

export async function fetchComments(postId: string): Promise<Array<{ id: string; body: string; created_at: string; user_id: string; author?: Profile }>> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, author:profiles!comments_user_id_fkey(*)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; body: string; created_at: string; user_id: string; author?: Profile }>;
}

export async function createComment(postId: string, body: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .insert({ post_id: postId, body: body.trim(), user_id: userId });
  if (error) throw error;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

/**
 * `/u/:handle` rotası hem username hem de id kabul eder.
 * Önce username olarak dener, bulunamazsa id olarak dener.
 * Handle geçerli bir UUID değilse (ör. bilinmeyen bir username), id
 * sorgusu Postgres tarafında hataya düşer; bu durumda sessizce null döner.
 */
export async function resolveProfileByHandle(handle: string): Promise<Profile | null> {
  const byUsername = await fetchProfileByUsername(handle);
  if (byUsername) return byUsername;
  try {
    return await fetchProfile(handle);
  } catch {
    return null;
  }
}

export async function uploadProfileImage(
  userId: string,
  file: File,
  kind: 'avatar' | 'cover',
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/${kind}.${ext}`;
  const { error } = await supabase.storage
    .from('profile-media')
    .upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from('profile-media').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId);
  if (error) throw error;
}

export async function fetchUserPosts(userId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, author:profiles!posts_user_id_fkey(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Post[];
}

export async function fetchUserBadges(userId: string): Promise<Badge[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('badge:badges(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => (r as unknown as { badge: Badge }).badge);
}

export async function fetchAllBadges(): Promise<Badge[]> {
  const { data, error } = await supabase.from('badges').select('*').order('tier');
  if (error) throw error;
  return (data ?? []) as Badge[];
}

export async function checkFollow(followerId: string, followedId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('followed_id', followedId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function toggleFollow(followerId: string, followedId: string, following: boolean): Promise<void> {
  if (following) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followed_id', followedId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, followed_id: followedId });
    if (error && error.code !== '23505') throw error;
  }
}

export async function fetchFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [f, g] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('followed_id', userId),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  if (f.error) throw f.error;
  if (g.error) throw g.error;
  return { followers: f.count ?? 0, following: g.count ?? 0 };
}

export async function fetchLeaderboard(
  scope: 'global' | 'country' | 'friends',
  viewerId: string,
  limit = 50,
): Promise<Profile[]> {
  let query = supabase.from('profiles').select('*');
  if (scope === 'country') {
    const me = await fetchProfile(viewerId);
    if (me?.country) query = query.eq('country', me.country);
    else return [];
  } else if (scope === 'friends') {
    const { data: following } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', viewerId);
    const ids = (following ?? []).map((f) => f.followed_id);
    ids.push(viewerId);
    if (ids.length === 0) return [];
    query = query.in('id', ids);
  }
  const { data, error } = await query.order('xp', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function fetchMissionsWithProgress(userId: string): Promise<{
  daily: MissionWithProgress[];
  weekly: MissionWithProgress[];
}> {
  const { data: missions, error: mErr } = await supabase
    .from('missions')
    .select('*')
    .eq('is_active', true)
    .order('created_at');
  if (mErr) throw mErr;

  const dailyKey = todayKey();
  const weeklyKey = weekKey();
  const { data: ums, error: uErr } = await supabase
    .from('user_missions')
    .select('*')
    .eq('user_id', userId)
    .in('period_key', [dailyKey, weeklyKey]);
  if (uErr) throw uErr;

  const umByMission: Record<string, UserMission> = {};
  for (const um of (ums ?? []) as UserMission[]) {
    umByMission[um.mission_id + um.period_key] = um;
  }

  const enrich = (m: Mission): MissionWithProgress => {
    const key = m.category === 'weekly' ? weeklyKey : dailyKey;
    const um = umByMission[m.id + key];
    return {
      ...m,
      user_mission: um,
      progress: um?.progress ?? 0,
      completed: um?.completed ?? false,
      claimed: um?.claimed ?? false,
    };
  };

  const daily = (missions ?? []).filter((m) => m.category === 'daily').map(enrich);
  const weekly = (missions ?? []).filter((m) => m.category === 'weekly').map(enrich);
  return { daily, weekly };
}

export async function fetchNotifications(userId: string): Promise<Array<{
  id: string; type: string; body: string; link: string | null; read: boolean; created_at: string; actor_id: string | null;
  actor?: Profile;
}>> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string; type: string; body: string; link: string | null; read: boolean; created_at: string; actor_id: string | null;
    actor?: Profile;
  }>;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
    .limit(20);
  if (error) throw error;
  return (data ?? []) as Profile[];
}
