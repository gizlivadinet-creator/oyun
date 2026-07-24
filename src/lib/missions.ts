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

  // Fire all count queries in parallel instead of one-at-a-time — this alone
  // turns up to 5 sequential network round-trips into a single round-trip.
  const jobs: Array<Promise<void>> = [];
  if (activeCodes.includes('daily_post')) {
    jobs.push(
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', dayStart)
        .then(({ count }) => { counts['daily_post'] = count ?? 0; }),
    );
  }
  if (activeCodes.includes('weekly_posts')) {
    jobs.push(
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', weekStart)
        .then(({ count }) => { counts['weekly_posts'] = count ?? 0; }),
    );
  }
  if (activeCodes.includes('daily_comment')) {
    jobs.push(
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', dayStart)
        .then(({ count }) => { counts['daily_comment'] = count ?? 0; }),
    );
  }
  if (activeCodes.includes('daily_like')) {
    jobs.push(
      supabase.from('likes').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', dayStart)
        .then(({ count }) => { counts['daily_like'] = count ?? 0; }),
    );
  }
  if (activeCodes.includes('weekly_follow')) {
    jobs.push(
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId).gte('created_at', weekStart)
        .then(({ count }) => { counts['weekly_follow'] = count ?? 0; }),
    );
  }
  await Promise.all(jobs);

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

  // All of these are independent reads — run them together instead of
  // waiting on each one sequentially (was up to 7 round-trips, now 1).
  const [
    { data: earned },
    { data: allBadges },
    { data: profile },
    postCount,
    commentCount,
    likeReceivedCount,
    followCount,
  ] = await Promise.all([
    supabase.from('user_badges').select('badge_id').eq('user_id', userId),
    supabase.from('badges').select('*'),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    countRows('posts', 'user_id', userId),
    countRows('comments', 'user_id', userId),
    countLikesReceived(userId),
    countRows('follows', 'follower_id', userId),
  ]);
  const earnedIds = new Set((earned ?? []).map((r) => r.badge_id));

  if (!allBadges) return awards;
  if (!profile) return awards;

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

/**
 * Runs mission progress refresh + badge checks together (they're independent
 * of each other) and never throws — intended to be called WITHOUT `await`
 * right after a social action, so the UI doesn't block on gamification
 * bookkeeping. Errors are swallowed/logged since this is best-effort.
 */
export function runGamificationInBackground(userId: string, refreshProfile?: () => Promise<void>): void {
  Promise.all([
    refreshMissionProgress(userId).catch((err) => console.error('mission refresh failed', err)),
    checkAndAwardBadges(userId).catch((err) => console.error('badge check failed', err)),
  ])
    .then(() => refreshProfile?.())
    .catch((err) => console.error('gamification background task failed', err));
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
