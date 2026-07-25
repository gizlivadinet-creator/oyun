import { useEffect, useState, useCallback, useRef } from 'react';
import { Bookmark, Heart, MessageCircle, Repeat2, BarChart3, Share as ShareIcon, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/Spinner';
import { toast } from '@/components/Toast';
import { PostMedia } from '@/components/PostMedia';
import { Lightbox, type LightboxItem } from '@/components/Lightbox';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import { resolveMediaType } from '@/lib/mediaEmbed';
import {
  fetchBookmarkedPosts, toggleLike, toggleRepost, toggleBookmark, fetchLikedIds, fetchRepostedIds,
} from '@/lib/services';
import type { Post } from '@/lib/types';

interface BookmarksPageProps {
  onOpenProfile: (id: string) => void;
}

export function BookmarksPage({ onOpenProfile }: BookmarksPageProps) {
  const { user, profile } = useAuth();
  const { t, locale } = useSettings();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const fetched = await fetchBookmarkedPosts(profile.id);
      const ids = fetched.map((p) => p.id);
      const [likedIds, repostedIds] = await Promise.all([
        fetchLikedIds(ids, profile.id),
        fetchRepostedIds(ids, profile.id),
      ]);
      setPosts(
        fetched.map((p) => ({
          ...p,
          liked_by_me: likedIds.has(p.id),
          reposted_by_me: repostedIds.has(p.id),
          bookmarked_by_me: true,
        })),
      );
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [profile, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnbookmark = async (post: Post) => {
    if (!user) return;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    try {
      await toggleBookmark(post.id, user.id, true);
      toast(t('feed.unbookmark'), 'success');
    } catch {
      toast(t('common.error'), 'error');
      load();
    }
  };

  const handleLike = async (post: Post) => {
    if (!user) return;
    const liked = !!post.liked_by_me;
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, liked_by_me: !liked, like_count: p.like_count + (liked ? -1 : 1) } : p)),
    );
    try {
      await toggleLike(post.id, user.id, liked);
    } catch {
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, liked_by_me: liked, like_count: p.like_count + (liked ? 1 : -1) } : p)),
      );
      toast(t('common.error'), 'error');
    }
  };

  const handleRepost = async (post: Post) => {
    if (!user) return;
    const reposted = !!post.reposted_by_me;
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, reposted_by_me: !reposted, repost_count: p.repost_count + (reposted ? -1 : 1) } : p)),
    );
    try {
      await toggleRepost(post.id, user.id, reposted);
      if (!reposted) toast(t('feed.reposted'), 'success');
    } catch {
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, reposted_by_me: reposted, repost_count: p.repost_count + (reposted ? 1 : -1) } : p)),
      );
      toast(t('common.error'), 'error');
    }
  };

  const handleShare = async (post: Post) => {
    const url = `${window.location.origin}${window.location.pathname}#/post/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: t('app.name'), text: post.body || t('app.name'), url });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(t('feed.linkCopied'), 'success');
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

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Bookmark className="h-5 w-5 text-sky-400" /> {t('bookmarks.title')}
      </h1>

      {posts.length === 0 ? (
        <div className="card p-10 text-center">
          <Bookmark className="h-10 w-10 text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">{t('bookmarks.empty')}</p>
        </div>
      ) : (
        posts.map((post) => (
          <BookmarkCard
            key={post.id}
            post={post}
            locale={locale}
            onLike={() => handleLike(post)}
            onRepost={() => handleRepost(post)}
            onUnbookmark={() => handleUnbookmark(post)}
            onShare={() => handleShare(post)}
            onOpenProfile={() => onOpenProfile(post.user_id)}
            onOpenMedia={() => post.media_url && setLightbox({ url: post.media_url, type: resolveMediaType(post.media_type) })}
            timeLabel={timeAgo(post.created_at, locale)}
          />
        ))
      )}

      <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

interface BookmarkCardProps {
  post: Post;
  locale: 'tr' | 'en';
  onLike: () => void;
  onRepost: () => void;
  onUnbookmark: () => void;
  onShare: () => void;
  onOpenProfile: () => void;
  onOpenMedia: () => void;
  timeLabel: string;
}

function BookmarkCard({ post, onLike, onRepost, onUnbookmark, onShare, onOpenProfile, onOpenMedia, timeLabel }: BookmarkCardProps) {
  const articleRef = useRef<HTMLElement>(null);
  return (
    <article ref={articleRef} className="card p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <button onClick={onOpenProfile} className="shrink-0">
          <Avatar id={post.user_id} name={post.author?.display_name ?? ''} url={post.author?.avatar_url} size="md" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <button onClick={onOpenProfile} className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-sm truncate">{post.author?.display_name ?? '...'}</span>
              <span className="chip bg-emerald-500/15 text-emerald-400 text-[9px] px-1.5 py-0 shrink-0">
                Lv.{post.author?.level ?? 1}
              </span>
            </button>
            <button onClick={onUnbookmark} className="btn-ghost p-1.5 -mr-1.5 rounded-lg text-sky-400 hover:text-rose-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-500">{timeLabel}</p>
        </div>
      </div>

      {post.body && (
        <p className="text-sm text-slate-100 mt-3 whitespace-pre-wrap break-words leading-relaxed">{post.body}</p>
      )}

      {post.media_url && (
        <PostMedia url={post.media_url} type={resolveMediaType(post.media_type)} onOpen={onOpenMedia} />
      )}

      <div className="flex items-center justify-between mt-3 -mx-1">
        <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400">
          <MessageCircle className="h-4 w-4" />
          {formatNumber(post.comment_count)}
        </span>

        <button
          onClick={onRepost}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-90',
            post.reposted_by_me ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10',
          )}
        >
          <Repeat2 className="h-4 w-4" />
          {formatNumber(post.repost_count)}
        </button>

        <button
          onClick={onLike}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-90',
            post.liked_by_me ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10',
          )}
        >
          <Heart className={cn('h-4 w-4 transition-transform', post.liked_by_me && 'fill-rose-400 scale-110')} />
          {formatNumber(post.like_count)}
        </button>

        <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400">
          <BarChart3 className="h-4 w-4" />
          {formatNumber(post.view_count)}
        </span>

        <button
          onClick={onShare}
          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-all active:scale-90"
        >
          <ShareIcon className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
