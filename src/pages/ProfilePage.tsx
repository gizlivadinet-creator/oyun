import { useEffect, useState, useCallback, useRef } from 'react';
import { Settings as SettingsIcon, Flame, Coins, Zap, Edit3, Save, X, MapPin, Camera, Repeat2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Avatar } from '@/components/Avatar';
import { XpBar } from '@/components/XpBar';
import { BadgeChip } from '@/components/BadgeChip';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { toast } from '@/components/Toast';
import { PostMedia } from '@/components/PostMedia';
import { Lightbox, type LightboxItem } from '@/components/Lightbox';
import { cn, formatNumber } from '@/lib/utils';
import { resolveMediaType } from '@/lib/mediaEmbed';
import {
  fetchUserFeed, fetchUserBadges, fetchFollowCounts,
  checkFollow, toggleFollow, updateProfile, fetchLikedIds, fetchRepostedIds, fetchBookmarkedIds,
  toggleLike, toggleRepost, toggleBookmark,
  uploadProfileImage, resolveProfileByHandle,
} from '@/lib/services';
import { Heart, MessageCircle, Trash2, Bookmark } from 'lucide-react';
import { deletePost } from '@/lib/services';
import { timeAgo } from '@/lib/utils';
import type { Profile, Post, Badge, FeedItem } from '@/lib/types';

interface ProfilePageProps {
  profileId: string;
  onOpenProfile: (id: string) => void;
  onBack: () => void;
}

export function ProfilePage({ profileId, onOpenProfile }: ProfilePageProps) {
  const { profile: me, user, refreshProfile, requireAuth } = useAuth();
  const { t, locale } = useSettings();
  const [target, setTarget] = useState<Profile | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [follows, setFollows] = useState({ followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editCoverUrl, setEditCoverUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const isMe = target ? target.id === me?.id : profileId === me?.id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // profileId burada bir handle'dır: gerçek id ya da username olabilir (/u/:handle rotası).
      const p = await resolveProfileByHandle(profileId);
      if (!p) {
        setTarget(null);
        setItems([]);
        setBadges([]);
        setFollows({ followers: 0, following: 0 });
        return;
      }
      const [{ items: fetchedItems }, userBadges, fCounts] = await Promise.all([
        fetchUserFeed(p.id),
        fetchUserBadges(p.id),
        fetchFollowCounts(p.id),
      ]);
      let enriched = fetchedItems;
      if (me) {
        const ids = Array.from(new Set(fetchedItems.map((it) => it.post.id)));
        const [likedIds, repostedIds, bookmarkedIds] = await Promise.all([
          fetchLikedIds(ids, me.id),
          fetchRepostedIds(ids, me.id),
          fetchBookmarkedIds(ids, me.id),
        ]);
        enriched = fetchedItems.map((it) => ({
          ...it,
          post: {
            ...it.post,
            liked_by_me: likedIds.has(it.post.id),
            reposted_by_me: repostedIds.has(it.post.id),
            bookmarked_by_me: bookmarkedIds.has(it.post.id),
          },
        }));
      }
      setTarget(p);
      setItems(enriched);
      setBadges(userBadges);
      setFollows(fCounts);
      if (me && p.id !== me.id) {
        checkFollow(me.id, p.id).then(setIsFollowing).catch(() => {});
      }
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [profileId, me, t]);

  useEffect(() => {
    load();
  }, [load]);

  const updatePostEverywhere = useCallback((postId: string, updater: (p: Post) => Post) => {
    setItems((prev) => prev.map((it) => (it.post.id === postId ? { ...it, post: updater(it.post) } : it)));
  }, []);

  const handleFollow = async () => {
    if (!requireAuth() || !me || !target) return;
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollows((prev) => ({
      ...prev,
      followers: prev.followers + (wasFollowing ? -1 : 1),
    }));
    try {
      await toggleFollow(me.id, target.id, wasFollowing);
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
    if (!requireAuth() || !me) return;
    setEditName(me.display_name);
    setEditBio(me.bio);
    setEditCountry(me.country);
    setEditAvatarUrl(me.avatar_url);
    setEditCoverUrl(me.cover_url);
    setEditing(true);
  };

  const handleImageSelect = async (file: File | undefined, kind: 'avatar' | 'cover') => {
    if (!file || !me) return;
    if (!file.type.startsWith('image/')) {
      toast(t('profile.invalidImage'), 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast(t('profile.imageTooLarge'), 'error');
      return;
    }
    const setUploading = kind === 'avatar' ? setUploadingAvatar : setUploadingCover;
    const setUrl = kind === 'avatar' ? setEditAvatarUrl : setEditCoverUrl;
    setUploading(true);
    try {
      const url = await uploadProfileImage(me.id, file, kind);
      setUrl(url);
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const saveEdit = async () => {
    if (!me) return;
    setSaving(true);
    try {
      await updateProfile(me.id, {
        display_name: editName.trim(),
        bio: editBio.trim(),
        country: editCountry.trim(),
        avatar_url: editAvatarUrl,
        cover_url: editCoverUrl,
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
      setItems((prev) => prev.filter((it) => it.post.id !== postId));
      toast(t('feed.delete'), 'success');
    } catch {
      toast(t('common.error'), 'error');
    }
  };

  const handleLike = async (post: Post) => {
    if (!requireAuth() || !user) return;
    const liked = !!post.liked_by_me;
    updatePostEverywhere(post.id, (p) => ({ ...p, liked_by_me: !liked, like_count: p.like_count + (liked ? -1 : 1) }));
    try {
      await toggleLike(post.id, user.id, liked);
    } catch {
      updatePostEverywhere(post.id, (p) => ({ ...p, liked_by_me: liked, like_count: p.like_count + (liked ? 1 : -1) }));
      toast(t('common.error'), 'error');
    }
  };

  const handleRepost = async (post: Post) => {
    if (!requireAuth() || !user) return;
    const reposted = !!post.reposted_by_me;
    updatePostEverywhere(post.id, (p) => ({
      ...p,
      reposted_by_me: !reposted,
      repost_count: p.repost_count + (reposted ? -1 : 1),
    }));
    try {
      await toggleRepost(post.id, user.id, reposted);
      if (!reposted) toast(t('feed.reposted'), 'success');
      if (isMe) await load();
    } catch {
      updatePostEverywhere(post.id, (p) => ({
        ...p,
        reposted_by_me: reposted,
        repost_count: p.repost_count + (reposted ? 1 : -1),
      }));
      toast(t('common.error'), 'error');
    }
  };

  const handleBookmark = async (post: Post) => {
    if (!requireAuth() || !user) return;
    const bookmarked = !!post.bookmarked_by_me;
    updatePostEverywhere(post.id, (p) => ({ ...p, bookmarked_by_me: !bookmarked }));
    try {
      await toggleBookmark(post.id, user.id, bookmarked);
      toast(t(bookmarked ? 'feed.unbookmark' : 'feed.bookmarked'), 'success');
    } catch {
      updatePostEverywhere(post.id, (p) => ({ ...p, bookmarked_by_me: bookmarked }));
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
        <div
          className="h-24 gradient-emerald relative bg-cover bg-center bg-no-repeat"
          style={target.cover_url ? { backgroundImage: `url(${target.cover_url})` } : undefined}
        >
          {target.is_premium && (
            <span className="absolute top-3 right-3 chip gradient-gold text-amber-950 text-[10px]">
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
                  isFollowing ? 'bg-black/5 text-slate-300 border border-black/10' : 'bg-emerald-500 text-slate-950',
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
            <Stat label={t('profile.posts')} value={items.filter((it) => it.kind === 'post').length} />
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
        {items.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-slate-500">{t('profile.noPosts')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const post = item.post;
              return (
                <div key={item.key} className="card p-3">
                  {item.kind === 'repost' && item.repostedBy && (
                    <p className="flex items-center gap-1.5 mb-2 -mt-0.5 text-[11px] font-semibold text-slate-500">
                      <Repeat2 className="h-3.5 w-3.5" />
                      {item.repostedBy.id === me?.id ? t('feed.repostedByYou') : `${item.repostedBy.display_name} ${t('feed.repostedBy')}`}
                    </p>
                  )}
                  {post.body && <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{post.body}</p>}
                  {post.media_url && (
                    <PostMedia
                      url={post.media_url}
                      type={resolveMediaType(post.media_type)}
                      onOpen={() => setLightbox({ url: post.media_url!, type: resolveMediaType(post.media_type) })}
                    />
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-slate-500">{timeAgo(post.created_at, locale)}</p>
                    <div className="flex items-center gap-0.5">
                      <span className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs text-slate-400">
                        <MessageCircle className="h-3.5 w-3.5" /> {formatNumber(post.comment_count)}
                      </span>
                      <button
                        onClick={() => handleRepost(post)}
                        className={cn(
                          'flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs transition-colors',
                          post.reposted_by_me ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-400',
                        )}
                      >
                        <Repeat2 className="h-3.5 w-3.5" /> {formatNumber(post.repost_count)}
                      </button>
                      <button
                        onClick={() => handleLike(post)}
                        className={cn(
                          'flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs transition-colors',
                          post.liked_by_me ? 'text-rose-400' : 'text-slate-400 hover:text-rose-400',
                        )}
                      >
                        <Heart className={cn('h-3.5 w-3.5', post.liked_by_me && 'fill-rose-400')} /> {formatNumber(post.like_count)}
                      </button>
                      <button
                        onClick={() => handleBookmark(post)}
                        className={cn(
                          'p-1 rounded-lg transition-colors',
                          post.bookmarked_by_me ? 'text-sky-400' : 'text-slate-400 hover:text-sky-400',
                        )}
                      >
                        <Bookmark className={cn('h-3.5 w-3.5', post.bookmarked_by_me && 'fill-sky-400')} />
                      </button>
                      {isMe && item.kind === 'post' && (
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
              );
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={t('profile.edit')}
        footer={
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-secondary flex-1">
              <X className="h-4 w-4" /> {t('profile.cancel')}
            </button>
            <button onClick={saveEdit} disabled={saving || uploadingAvatar || uploadingCover} className="btn-primary flex-1">
              {saving ? <Spinner size="sm" /> : <><Save className="h-4 w-4" /> {t('profile.save')}</>}
            </button>
          </div>
        }
      >
        <div className="space-y-4 pb-1">
          {/* Cover photo */}
          <div>
            <label className="label">{t('profile.changeCover')}</label>
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="relative w-full h-20 rounded-xl overflow-hidden gradient-emerald bg-cover bg-center bg-no-repeat group"
              style={editCoverUrl ? { backgroundImage: `url(${editCoverUrl})` } : undefined}
            >
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-active:bg-black/40">
                {uploadingCover ? <Spinner size="sm" /> : <Camera className="h-5 w-5 text-white" />}
              </div>
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageSelect(e.target.files?.[0], 'cover')}
            />
          </div>

          {/* Avatar */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative"
            >
              <Avatar id={me?.id ?? ''} name={editName || me?.display_name || ''} url={editAvatarUrl} size="xl" ring />
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                {uploadingAvatar ? <Spinner size="sm" /> : <Camera className="h-5 w-5 text-white" />}
              </div>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageSelect(e.target.files?.[0], 'avatar')}
            />
          </div>

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
        </div>
      </Modal>

      <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
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
