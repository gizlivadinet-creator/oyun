import { useEffect, useState, useCallback } from 'react';
import { Settings as SettingsIcon, Flame, Coins, Zap, Edit3, Save, X, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Avatar } from '@/components/Avatar';
import { XpBar } from '@/components/XpBar';
import { BadgeChip } from '@/components/BadgeChip';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { toast } from '@/components/Toast';
import { cn, formatNumber } from '@/lib/utils';
import {
  fetchProfile, fetchUserPosts, fetchUserBadges, fetchFollowCounts,
  checkFollow, toggleFollow, updateProfile, fetchLikedIds, toggleLike,
} from '@/lib/services';
import { Heart, MessageCircle, Trash2 } from 'lucide-react';
import { deletePost } from '@/lib/services';
import { timeAgo } from '@/lib/utils';
import type { Profile, Post, Badge } from '@/lib/types';

interface ProfilePageProps {
  profileId: string;
  onOpenProfile: (id: string) => void;
  onBack: () => void;
}

export function ProfilePage({ profileId, onOpenProfile }: ProfilePageProps) {
  const { profile: me, user, refreshProfile } = useAuth();
  const { t, locale } = useSettings();
  const [target, setTarget] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [follows, setFollows] = useState({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [saving, setSaving] = useState(false);

  const isMe = profileId === me?.id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, userPosts, userBadges, fCounts] = await Promise.all([
        fetchProfile(profileId),
        fetchUserPosts(profileId),
        fetchUserBadges(profileId),
        fetchFollowCounts(profileId),
      ]);
      setTarget(p);
      setPosts(userPosts);
      setBadges(userBadges);
      setFollows(fCounts);
      if (me && !isMe) {
        checkFollow(me.id, profileId).then(setIsFollowing).catch(() => {});
      }
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [profileId, me, isMe, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFollow = async () => {
    if (!me) return;
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollows((prev) => ({
      ...prev,
      followers: prev.followers + (wasFollowing ? -1 : 1),
    }));
    try {
      await toggleFollow(me.id, profileId, wasFollowing);
    } catch {
      setIsFollowing(wasFollowing);
      setFollows((prev) => ({
        ...prev,
        followers: prev.followers + (wasFollowing ? 1 : -1),
      }));
      toast(t('common.error'), 'error');
    }
  };

  const openEdit = () => {
    if (!me) return;
    setEditName(me.display_name);
    setEditBio(me.bio);
    setEditCountry(me.country);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!me) return;
    setSaving(true);
    try {
      await updateProfile(me.id, {
        display_name: editName.trim(),
        bio: editBio.trim(),
        country: editCountry.trim(),
      });
      await refreshProfile();
      await load();
      setEditing(false);
      toast(t('common.save'), 'success');
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    try {
      await deletePost(postId, user.id);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast(t('feed.delete'), 'success');
    } catch {
      toast(t('common.error'), 'error');
    }
  };

  const handleLike = async (post: Post) => {
    if (!user) return;
    const liked = !!post.liked_by_me;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, liked_by_me: !liked, like_count: p.like_count + (liked ? -1 : 1) }
          : p,
      ),
    );
    try {
      await toggleLike(post.id, user.id, liked);
    } catch {
      toast(t('common.error'), 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!target) {
    return <div className="text-center py-20 text-slate-400">{t('common.error')}</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header card */}
      <div className="card overflow-hidden">
        <div className="h-24 gradient-emerald relative">
          {target.is_premium && (
            <span className="absolute top-3 right-3 chip gradient-gold text-slate-950 text-[10px]">
              ★ Premium
            </span>
          )}
        </div>
        <div className="px-4 pb-4 -mt-12">
          <div className="flex items-end justify-between">
            <Avatar
              id={target.id}
              name={target.display_name}
              url={target.avatar_url}
              size="xl"
              ring
              className="ring-4 ring-slate-950"
            />
            {isMe ? (
              <button onClick={openEdit} className="btn-secondary py-2 px-3 text-xs">
                <Edit3 className="h-3.5 w-3.5" /> {t('profile.edit')}
              </button>
            ) : (
              <button
                onClick={handleFollow}
                className={cn(
                  'btn py-2 px-4 text-xs',
                  isFollowing ? 'bg-white/5 text-slate-300 border border-white/10' : 'bg-emerald-500 text-slate-950',
                )}
              >
                {isFollowing ? t('profile.unfollow') : t('profile.follow')}
              </button>
            )}
          </div>

          <div className="mt-3">
            <h1 className="text-lg font-bold">{target.display_name}</h1>
            {target.username && <p className="text-sm text-slate-400">@{target.username}</p>}
            {target.bio && <p className="text-sm text-slate-300 mt-2">{target.bio}</p>}
            {target.country && (
              <p className="flex items-center gap-1 text-xs text-slate-500 mt-2">
                <MapPin className="h-3 w-3" /> {target.country}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <Stat label={t('profile.posts')} value={posts.length} />
            <Stat label={t('profile.followers')} value={follows.followers} />
            <Stat label={t('profile.following')} value={follows.following} />
            <Stat label={t('profile.level')} value={target.level} accent />
          </div>
        </div>
      </div>

      {/* Gamification stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="stat-tile">
          <Zap className="h-5 w-5 text-emerald-400" />
          <span className="text-lg font-bold tabular-nums">{formatNumber(target.xp)}</span>
          <span className="text-[10px] text-slate-500">{t('profile.xp')}</span>
        </div>
        <div className="stat-tile">
          <Coins className="h-5 w-5 text-amber-400" />
          <span className="text-lg font-bold tabular-nums">{formatNumber(target.coins)}</span>
          <span className="text-[10px] text-slate-500">{t('profile.coins')}</span>
        </div>
        <div className="stat-tile">
          <Flame className="h-5 w-5 text-orange-400" />
          <span className="text-lg font-bold tabular-nums">{target.streak}</span>
          <span className="text-[10px] text-slate-500">{t('profile.streak')}</span>
        </div>
      </div>

      {/* XP progress */}
      <div className="card p-4">
        <XpBar xp={target.xp} />
      </div>

      {/* Badges */}
      <div className="card p-4">
        <h2 className="text-sm font-bold mb-3">{t('profile.badges')}</h2>
        {badges.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-4">{t('profile.noBadges')}</p>
        ) : (
          <div className="flex flex-wrap gap-3 justify-center">
            {badges.map((b) => (
              <BadgeChip key={b.id} badge={b} size="sm" earned locale={locale} />
            ))}
          </div>
        )}
      </div>

      {/* Posts */}
      <div>
        <h2 className="text-sm font-bold mb-2 px-1">{t('profile.posts')}</h2>
        {posts.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-slate-500">{t('profile.noPosts')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="card p-3">
                <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{post.body}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-slate-500">{timeAgo(post.created_at, locale)}</p>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Heart className="h-3.5 w-3.5" /> {formatNumber(post.like_count)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <MessageCircle className="h-3.5 w-3.5" /> {formatNumber(post.comment_count)}
                    </span>
                    {isMe && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title={t('profile.edit')}>
        <div className="space-y-3">
          <div>
            <label className="label">{t('profile.displayName')}</label>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={30} />
          </div>
          <div>
            <label className="label">{t('profile.bio')}</label>
            <textarea className="input min-h-[72px] resize-none" value={editBio} onChange={(e) => setEditBio(e.target.value.slice(0, 160))} maxLength={160} placeholder={t('profile.bioPlaceholder')} />
          </div>
          <div>
            <label className="label">{t('profile.country')}</label>
            <input className="input" value={editCountry} onChange={(e) => setEditCountry(e.target.value)} maxLength={40} />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setEditing(false)} className="btn-secondary flex-1">
              <X className="h-4 w-4" /> {t('profile.cancel')}
            </button>
            <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">
              {saving ? <Spinner size="sm" /> : <><Save className="h-4 w-4" /> {t('profile.save')}</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn('text-base font-bold tabular-nums', accent && 'text-emerald-400')}>{formatNumber(value)}</span>
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
}
