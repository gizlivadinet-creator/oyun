import { useEffect, useState, useCallback, useRef } from 'react';
import { Heart, MessageCircle, Trash2, Send, Plus, Loader2, Image as ImageIcon, Video, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { toast } from '@/components/Toast';
import { PostMedia } from '@/components/PostMedia';
import { Lightbox, type LightboxItem } from '@/components/Lightbox';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import {
  fetchFeed, fetchLikedIds, createPost, deletePost, toggleLike,
  fetchComments, createComment, uploadPostMedia,
} from '@/lib/services';
import { runGamificationInBackground } from '@/lib/missions';
import type { Post, Comment } from '@/lib/types';

interface FeedPageProps {
  onOpenProfile: (id: string) => void;
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

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
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);

  // Composer attachment state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<'image' | 'video' | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    return () => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  const pickMedia = (kind: 'image' | 'video', file: File | undefined) => {
    if (!file) return;
    const maxBytes = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (kind === 'image' && !file.type.startsWith('image/')) {
      toast(t('profile.invalidImage'), 'error');
      return;
    }
    if (kind === 'video' && !file.type.startsWith('video/')) {
      toast(t('feed.invalidVideo'), 'error');
      return;
    }
    if (file.size > maxBytes) {
      toast(kind === 'image' ? t('profile.imageTooLarge') : t('feed.videoTooLarge'), 'error');
      return;
    }
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaKind(kind);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaKind(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handlePost = async () => {
    const body = composing.trim();
    if ((!body && !mediaFile) || !user || !profile) return;
    if (body.length > 500) {
      toast(t('feed.tooLong'), 'error');
      return;
    }
    setPosting(true);
    try {
      let media: { url: string; type: 'image' | 'video' } | null = null;
      if (mediaFile) {
        media = await uploadPostMedia(user.id, mediaFile);
      }
      const newPost = await createPost(body, user.id, media);
      newPost.author = profile;
      newPost.liked_by_me = false;
      setPosts((prev) => [newPost, ...prev]);
      setComposing('');
      clearMedia();
      toast(`+10 XP`, 'success');
      // Gamification bookkeeping runs in the background so the composer
      // doesn't sit there waiting on 5+ extra network round-trips.
      runGamificationInBackground(user.id, refreshProfile);
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
      runGamificationInBackground(user.id);
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
      runGamificationInBackground(user.id, refreshProfile);
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
          <div className="flex-1 min-w-0">
            <textarea
              className="input min-h-[60px] resize-none"
              value={composing}
              onChange={(e) => setComposing(e.target.value.slice(0, 500))}
              placeholder={t('feed.createPlaceholder')}
              maxLength={500}
            />

            {mediaPreview && (
              <div className="relative mt-2 rounded-xl overflow-hidden border border-white/10 w-fit max-w-full">
                {mediaKind === 'image' ? (
                  <img src={mediaPreview} alt="" className="max-h-48 object-cover" />
                ) : (
                  <video src={mediaPreview} className="max-h-48" controls muted />
                )}
                <button
                  onClick={clearMedia}
                  type="button"
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
                  aria-label={t('feed.removeMedia')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={posting}
                  className="btn-ghost p-2 rounded-lg text-slate-400 hover:text-emerald-400"
                  aria-label={t('feed.addImage')}
                  title={t('feed.addImage')}
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={posting}
                  className="btn-ghost p-2 rounded-lg text-slate-400 hover:text-emerald-400"
                  aria-label={t('feed.addVideo')}
                  title={t('feed.addVideo')}
                >
                  <Video className="h-4 w-4" />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { pickMedia('image', e.target.files?.[0]); e.target.value = ''; }}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => { pickMedia('video', e.target.files?.[0]); e.target.value = ''; }}
                />
                <span className="text-[10px] text-slate-500 tabular-nums ml-1">{composing.length}/500</span>
              </div>
              <button
                onClick={handlePost}
                disabled={(!composing.trim() && !mediaFile) || posting}
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
            onOpenMedia={() => post.media_url && setLightbox({ url: post.media_url, type: post.media_type === 'video' ? 'video' : 'image' })}
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
        footer={
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
        }
      >
        <div className="space-y-3 max-h-[40vh] overflow-y-auto no-scrollbar">
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
      </Modal>

      <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
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
  onOpenMedia: () => void;
  isOwner: boolean;
  timeLabel: string;
}

function PostCard({ post, onLike, onComment, onDelete, onOpenProfile, onOpenMedia, isOwner, timeLabel }: PostCardProps) {
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

      {post.body && (
        <p className="text-sm text-slate-100 mt-3 whitespace-pre-wrap break-words leading-relaxed">{post.body}</p>
      )}

      {post.media_url && (
        <PostMedia url={post.media_url} type={post.media_type === 'video' ? 'video' : 'image'} onOpen={onOpenMedia} />
      )}

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
