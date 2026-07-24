import { useEffect, useState, useCallback } from 'react';
import { Heart, MessageCircle, Trash2, Send, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { toast } from '@/components/Toast';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import {
  fetchFeed, fetchLikedIds, createPost, deletePost, toggleLike,
  fetchComments, createComment,
} from '@/lib/services';
import { refreshMissionProgress, checkAndAwardBadges } from '@/lib/missions';
import type { Post, Comment } from '@/lib/types';

interface FeedPageProps {
  onOpenProfile: (id: string) => void;
}

export function FeedPage({ onOpenProfile }: FeedPageProps) {
  const { profile, user, refreshProfile } = useAuth();
  const { t, locale } = useSettings();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [composing, setComposing] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentModal, setCommentModal] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  const load = useCallback(async (p: number, replace: boolean) => {
    try {
      const { posts: fetched, hasMore: more } = await fetchFeed(p);
      if (!profile) return;
      const likedIds = await fetchLikedIds(
        fetched.map((x) => x.id),
        profile.id,
      );
      const enriched = fetched.map((p) => ({ ...p, liked_by_me: likedIds.has(p.id) }));
      setPosts((prev) => (replace ? enriched : [...prev, ...enriched]));
      setHasMore(more);
      setPage(p);
    } catch (err) {
      toast(t('common.error'), 'error');
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [profile, t]);

  useEffect(() => {
    load(0, true);
  }, [load]);

  const handlePost = async () => {
    const body = composing.trim();
    if (!body || !user || !profile) return;
    if (body.length > 500) {
      toast(t('feed.tooLong'), 'error');
      return;
    }
    setPosting(true);
    try {
      const newPost = await createPost(body, user.id);
      newPost.author = profile;
      newPost.liked_by_me = false;
      setPosts((prev) => [newPost, ...prev]);
      setComposing('');
      toast(`+10 XP`, 'success');
      await refreshMissionProgress(user.id);
      await checkAndAwardBadges(user.id);
      await refreshProfile();
    } catch (err) {
      toast(t('common.error'), 'error');
      console.error(err);
    } finally {
      setPosting(false);
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
      await refreshMissionProgress(user.id);
    } catch (err) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, liked_by_me: liked, like_count: p.like_count + (liked ? 1 : -1) }
            : p,
        ),
      );
      toast(t('common.error'), 'error');
      console.error(err);
    }
  };

  const handleDelete = async (post: Post) => {
    if (!user || post.user_id !== user.id) return;
    if (!confirm(t('feed.deleteConfirm'))) return;
    try {
      await deletePost(post.id, user.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast(t('feed.delete'), 'success');
    } catch {
      toast(t('common.error'), 'error');
    }
  };

  const openComments = async (post: Post) => {
    setCommentModal(post);
    setCommentText('');
    setLoadingComments(true);
    try {
      const fetched = await fetchComments(post.id);
      setComments(fetched as unknown as Comment[]);
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setLoadingComments(false);
    }
  };

  const sendComment = async () => {
    const body = commentText.trim();
    if (!body || !commentModal || !user) return;
    setSendingComment(true);
    try {
      await createComment(commentModal.id, body, user.id);
      const fetched = await fetchComments(commentModal.id);
      setComments(fetched as unknown as Comment[]);
      setCommentText('');
      setPosts((prev) =>
        prev.map((p) =>
          p.id === commentModal.id ? { ...p, comment_count: p.comment_count + 1 } : p,
        ),
      );
      toast(`+5 XP`, 'success');
      await refreshMissionProgress(user.id);
      await checkAndAwardBadges(user.id);
      await refreshProfile();
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setSendingComment(false);
    }
  };

  const loadMore = () => {
    setLoadingMore(true);
    load(page + 1, false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="card p-4 animate-slide-up">
        <div className="flex gap-3">
          <Avatar id={profile?.id ?? ''} name={profile?.display_name ?? ''} url={profile?.avatar_url} size="md" />
          <div className="flex-1">
            <textarea
              className="input min-h-[60px] resize-none"
              value={composing}
              onChange={(e) => setComposing(e.target.value.slice(0, 500))}
              placeholder={t('feed.createPlaceholder')}
              maxLength={500}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-slate-500 tabular-nums">{composing.length}/500</span>
              <button
                onClick={handlePost}
                disabled={!composing.trim() || posting}
                className="btn-primary py-2 px-4 text-xs"
              >
                {posting ? <Spinner size="sm" /> : <><Plus className="h-3.5 w-3.5" /> {t('feed.post')}</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="card p-10 text-center animate-fade-in">
          <p className="text-slate-400">{t('feed.empty')}</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            locale={locale}
            onLike={() => handleLike(post)}
            onComment={() => openComments(post)}
            onDelete={() => handleDelete(post)}
            onOpenProfile={() => onOpenProfile(post.user_id)}
            isOwner={post.user_id === user?.id}
            timeLabel={timeAgo(post.created_at, locale)}
          />
        ))
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button onClick={loadMore} className="btn-secondary" disabled={loadingMore}>
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : t('feed.loadMore')}
          </button>
        </div>
      )}
      {!hasMore && posts.length > 0 && (
        <p className="text-center text-xs text-slate-600 py-4">{t('feed.end')}</p>
      )}

      {/* Comment modal */}
      <Modal
        open={!!commentModal}
        onClose={() => setCommentModal(null)}
        title={t('feed.comments')}
      >
        <div className="space-y-3 max-h-[40vh] overflow-y-auto no-scrollbar mb-3">
          {loadingComments ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-6">{t('feed.empty')}</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2.5 animate-fade-in">
                <Avatar
                  id={c.user_id}
                  name={c.author?.display_name ?? ''}
                  url={c.author?.avatar_url}
                  size="sm"
                />
                <div className="flex-1">
                  <div className="glass rounded-xl px-3 py-2">
                    <p className="text-xs font-semibold text-emerald-400">
                      {c.author?.display_name ?? '...'}
                    </p>
                    <p className="text-sm text-slate-200 mt-0.5">{c.body}</p>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 ml-1">{timeAgo(c.created_at, locale)}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value.slice(0, 300))}
            placeholder={t('feed.commentPlaceholder')}
            maxLength={300}
            onKeyDown={(e) => e.key === 'Enter' && sendComment()}
          />
          <button onClick={sendComment} className="btn-primary px-3" disabled={!commentText.trim() || sendingComment}>
            {sendingComment ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </Modal>
    </div>
  );
}

interface PostCardProps {
  post: Post;
  locale: 'tr' | 'en';
  onLike: () => void;
  onComment: () => void;
  onDelete: () => void;
  onOpenProfile: () => void;
  isOwner: boolean;
  timeLabel: string;
}

function PostCard({ post, locale, onLike, onComment, onDelete, onOpenProfile, isOwner, timeLabel }: PostCardProps) {
  return (
    <article className="card p-4 animate-slide-up">
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
            {isOwner && (
              <button onClick={onDelete} className="btn-ghost p-1.5 -mr-1.5 rounded-lg text-slate-500 hover:text-rose-400">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">{timeLabel}</p>
        </div>
      </div>

      <p className="text-sm text-slate-100 mt-3 whitespace-pre-wrap break-words leading-relaxed">{post.body}</p>

      <div className="flex items-center gap-1 mt-3 -mx-1">
        <button
          onClick={onLike}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-90',
            post.liked_by_me ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:bg-white/5',
          )}
        >
          <Heart className={cn('h-4 w-4 transition-transform', post.liked_by_me && 'fill-rose-400 scale-110')} />
          {formatNumber(post.like_count)}
        </button>
        <button
          onClick={onComment}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-white/5 transition-all active:scale-90"
        >
          <MessageCircle className="h-4 w-4" />
          {formatNumber(post.comment_count)}
        </button>
      </div>
    </article>
  );
}
