import { supabase } from '@/lib/supabase';
import { todayKey, weekKey } from '@/lib/utils';
import { toast } from '@/components/Toast';
import type { Profile, Mission, UserMission } from '@/lib/types';

/**
 * Recomputes mission progress for a user based on real activity counts.
 * Called after every social action (post, like, comment, follow).
 * Awards XP/coins on claim.
 */
export async function refreshMissionProgress(userId: string): Promise<void> {
  const { data: missions, error } = await supabase
    .from('missions')
    .select('*')
    .eq('is_active', true);
  if (error || !missions) return;

  const dailyKey = todayKey();
  const weeklyKey = weekKey();

  const codes = missions.map((m) => m.code);
  const activeCodes: string[] = [];
  if (codes.includes('daily_post')) activeCodes.push('daily_post');
  if (codes.includes('daily_comment')) activeCodes.push('daily_comment');
  if (codes.includes('daily_like')) activeCodes.push('daily_like');
  if (codes.includes('weekly_posts')) activeCodes.push('weekly_posts');
  if (codes.includes('weekly_follow')) activeCodes.push('weekly_follow');

  const counts: Record<string, number> = {};

  const dayStart = new Date(dailyKey + 'T00:00:00').toISOString();
  const weekStart = new Date(weeklyKey + 'T00:00:00').toISOString();

  if (activeCodes.includes('daily_post')) {
    const { count } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayStart);
    counts['daily_post'] = count ?? 0;
  }
  if (activeCodes.includes('weekly_posts')) {
    const { count } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', weekStart);
    counts['weekly_posts'] = count ?? 0;
  }
  if (activeCodes.includes('daily_comment')) {
    const { count } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayStart);
    counts['daily_comment'] = count ?? 0;
  }
  if (activeCodes.includes('daily_like')) {
    const { count } = await supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', dayStart);
    counts['daily_like'] = count ?? 0;
  }
  if (activeCodes.includes('weekly_follow')) {
    const { count } = await supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', userId)
      .gte('created_at', weekStart);
    counts['weekly_follow'] = count ?? 0;
  }

  const upserts: Array<Partial<UserMission> & { user_id: string; mission_id: string; period_key: string }> = [];

  for (const m of missions as Mission[]) {
    const key = m.category === 'weekly' ? weeklyKey : dailyKey;
    const progress = Math.min(counts[m.code] ?? 0, m.target);
    const completed = progress >= m.target;
    upserts.push({
      user_id: userId,
      mission_id: m.id,
      period_key: key,
      progress,
      completed,
      claimed: false,
    });
  }

  await supabase
    .from('user_missions')
    .upsert(upserts, { onConflict: 'user_id,mission_id,period_key' })
    .eq('user_id', userId);
}

export async function claimMissionReward(
  userMission: UserMission,
  mission: Mission,
  userId: string,
): Promise<Profile | null> {
  if (!userMission.completed || userMission.claimed) return null;

  const { error: uErr } = await supabase
    .from('user_missions')
    .update({ claimed: true })
    .eq('id', userMission.id)
    .eq('user_id', userId);
  if (uErr) throw uErr;

  const { data: prof, error: pErr } = await supabase.rpc('claim_rewards', {
    uid: userId,
    xp_amount: mission.xp_reward,
    coin_amount: mission.coin_reward,
  });
  if (pErr) throw pErr;

  toast(`+${mission.xp_reward} XP, +${mission.coin_reward} Coin`, 'success');
  return (prof as Profile) ?? null;
}

export async function checkAndAwardBadges(userId: string): Promise<BadgeAward[]> {
  const awards: BadgeAward[] = [];

  const { data: earned } = await supabase
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', userId);
  const earnedIds = new Set((earned ?? []).map((r) => r.badge_id));

  const { data: allBadges } = await supabase.from('badges').select('*');
  if (!allBadges) return awards;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return awards;

  const postCount = await countRows('posts', 'user_id', userId);
  const commentCount = await countRows('comments', 'user_id', userId);
  const likeReceivedCount = await countLikesReceived(userId);
  const followCount = await countRows('follows', 'follower_id', userId);

  const criteria: Record<string, boolean> = {
    first_post: postCount >= 1,
    social_10: postCount >= 10,
    liked_50: likeReceivedCount >= 50,
    commenter: commentCount >= 20,
    streak_7: (profile as Profile).streak >= 7,
    level_10: (profile as Profile).level >= 10,
    follow_25: followCount >= 25,
    verified_xp: (profile as Profile).xp >= 5000,
  };

  const toInsert: Array<{ user_id: string; badge_id: string }> = [];
  for (const b of allBadges) {
    if (earnedIds.has(b.id)) continue;
    if (criteria[b.code]) {
      toInsert.push({ user_id: userId, badge_id: b.id });
      awards.push({ code: b.code, name_tr: b.name_tr, name_en: b.name_en, icon: b.icon });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('user_badges').insert(toInsert);
    if (error) throw error;
    for (const a of awards) {
      toast(`🏆 ${a.name_tr} rozeti kazandın!`, 'success');
    }
  }

  return awards;
}

export interface BadgeAward {
  code: string;
  name_tr: string;
  name_en: string;
  icon: string;
}

async function countRows(table: string, col: string, val: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(col, val);
  if (error) return 0;
  return count ?? 0;
}

async function countLikesReceived(userId: string): Promise<number> {
  const { data: userPosts } = await supabase
    .from('posts')
    .select('id')
    .eq('user_id', userId);
  const postIds = (userPosts ?? []).map((p) => p.id);
  if (postIds.length === 0) return 0;
  const { count, error } = await supabase
    .from('likes')
    .select('id', { count: 'exact', head: true })
    .in('post_id', postIds);
  if (error) return 0;
  return count ?? 0;
}
