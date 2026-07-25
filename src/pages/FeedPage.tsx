import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Heart, MessageCircle, Trash2, Send, Plus, Loader2, Image as ImageIcon, Video, X, Link2, Check,
  Repeat2, BarChart3, Bookmark, Share as ShareIcon, LogIn,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';
import { toast } from '@/components/Toast';
import { PostMedia } from '@/components/PostMedia';
import { Lightbox, type LightboxItem } from '@/components/Lightbox';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import { parseMediaUrl, PROVIDER_LABEL, resolveMediaType, type ParsedMedia } from '@/lib/mediaEmbed';
import {
  fetchFeed, fetchLikedIds, createPost, deletePost, toggleLike,
  fetchRepostedIds, toggleRepost, fetchBookmarkedIds, toggleBookmark, incrementPostView,
  fetchComments, createComment, uploadPostMedia,
} from '@/lib/services';
import { runGamificationInBackground } from '@/lib/missions';
import type { Post, Comment, FeedItem, Profile } from '@/lib/types';

interface FeedPageProps {
  onOpenProfile: (id: string) => void;
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function FeedPage({ onOpenProfile }: FeedPageProps) {
  const { profile, user, refreshProfile, requireAuth } = useAuth();
  const { t, locale } = useSettings();
  const [items, setItems] = useState<FeedItem[]>([]);
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

  // Composer attachment state (file upload)
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<'image' | 'video' | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Composer attachment state (URL-based image/video, incl. YouTube,
  // Dailymotion, Vimeo, Facebook, Instagram, TikTok)
  const [showUrlField, setShowUrlField] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlMedia, setUrlMedia] = useState<ParsedMedia | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Applies a per-post update everywhere that post appears in the timeline
  // — the same post can show up both as an original entry and as one or
  // more repost entries, and all of them must stay in sync (e.g. a like
  // toggled from the "repost" copy must also update the "original" copy).
  const updatePostEverywhere = useCallback((postId: string, updater: (p: Post) => Post) => {
    setItems((prev) => prev.map((it) => (it.post.id === postId ? { ...it, post: updater(it.post) } : it)));
  }, []);

  const load = useCallback(async (p: number, replace: boolean) => {
    try {
      const { items: fetched, hasMore: more } = await fetchFeed(p);
      let enriched = fetched;
      if (profile) {
        const ids = Array.from(new Set(fetched.map((it) => it.post.id)));
        const [likedIds, repostedIds, bookmarkedIds] = await Promise.all([
          fetchLikedIds(ids, profile.id),
          fetchRepostedIds(ids, profile.id),
          fetchBookmarkedIds(ids, profile.id),
        ]);
        enriched = fetched.map((it) => ({
          ...it,
          post: {
            ...it.post,
            liked_by_me: likedIds.has(it.post.id),
            reposted_by_me: repostedIds.has(it.post.id),
            bookmarked_by_me: bookmarkedIds.has(it.post.id),
          },
        }));
      }
      setItems((prev) => (replace ? enriched : [...prev, ...enriched]));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

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
    // A post can only carry one attachment — picking a file clears any
    // pending URL-based attachment.
    setUrlMedia(null);
    setUrlDraft('');
    setUrlError(null);
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
    setUrlMedia(null);
    setUrlDraft('');
    setUrlError(null);
    setShowUrlField(false);
  };

  const applyUrlMedia = () => {
    const value = urlDraft.trim();
    if (!value) return;
    const parsed = parseMediaUrl(value);
    if (!parsed) {
      setUrlError(t('feed.invalidUrl'));
      return;
    }
    setUrlError(null);
    // A pasted URL replaces any file that was already picked.
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaKind(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    setUrlMedia(parsed);
  };

  const handlePost = async () => {
    if (!requireAuth()) return;
    const body = composing.trim();
    if ((!body && !mediaFile && !urlMedia) || !user || !profile) return;
    if (body.length > 500) {
      toast(t('feed.tooLong'), 'error');
      return;
    }
    setPosting(true);
    try {
      let media: { url: string; type: 'image' | 'video' | 'embed' } | null = null;
      if (mediaFile) {
        media = await uploadPostMedia(user.id, mediaFile);
      } else if (urlMedia) {
        media = { url: urlMedia.url, type: urlMedia.type };
      }
      const newPost = await createPost(body, user.id, media);
      newPost.author = profile;
      newPost.liked_by_me = false;
      newPost.reposted_by_me = false;
      newPost.bookmarked_by_me = false;
      const newItem: FeedItem = {
        key: `${newPost.id}:post`,
        activityAt: newPost.created_at,
        kind: 'post',
        repostedBy: null,
        post: newPost,
      };
      setItems((prev) => [newItem, ...prev]);
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
    if (!requireAuth() || !user) return;
    const liked = !!post.liked_by_me;
    updatePostEverywhere(post.id, (p) => ({ ...p, liked_by_me: !liked, like_count: p.like_count + (liked ? -1 : 1) }));
    try {
      await toggleLike(post.id, user.id, liked);
      runGamificationInBackground(user.id);
    } catch (err) {
      updatePostEverywhere(post.id, (p) => ({ ...p, liked_by_me: liked, like_count: p.like_count + (liked ? 1 : -1) }));
      toast(t('common.error'), 'error');
      console.error(err);
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
      if (!reposted) {
        toast(t('feed.reposted'), 'success');
        // Immediately reflect the repost as a new timeline entry at the top
        // (mirroring what a fresh feed load from the server would return)
        // instead of waiting for the next full refresh.
        setItems((prev) => {
          const already = prev.some((it) => it.kind === 'repost' && it.post.id === post.id && it.repostedBy?.id === profile?.id);
          if (already || !profile) return prev;
          const source = prev.find((it) => it.post.id === post.id)?.post ?? post;
          const repostItem: FeedItem = {
            key: `${post.id}:repost:${Date.now()}`,
            activityAt: new Date().toISOString(),
            kind: 'repost',
            repostedBy: profile,
            post: { ...source, reposted_by_me: true, repost_count: source.repost_count + (reposted ? 0 : 1) },
          };
          return [repostItem, ...prev];
        });
      } else {
        setItems((prev) => prev.filter((it) => !(it.kind === 'repost' && it.post.id === post.id && it.repostedBy?.id === profile?.id)));
      }
    } catch (err) {
      updatePostEverywhere(post.id, (p) => ({
        ...p,
        reposted_by_me: reposted,
        repost_count: p.repost_count + (reposted ? 1 : -1),
      }));
      toast(t('common.error'), 'error');
      console.error(err);
    }
  };

  const handleBookmark = async (post: Post) => {
    if (!requireAuth() || !user) return;
    const bookmarked = !!post.bookmarked_by_me;
    updatePostEverywhere(post.id, (p) => ({ ...p, bookmarked_by_me: !bookmarked }));
    try {
      await toggleBookmark(post.id, user.id, bookmarked);
      toast(t(bookmarked ? 'feed.unbookmark' : 'feed.bookmarked'), 'success');
    } catch (err) {
      updatePostEverywhere(post.id, (p) => ({ ...p, bookmarked_by_me: bookmarked }));
      toast(t('common.error'), 'error');
      console.error(err);
    }
  };

  const handleShare = async (post: Post) => {
    const url = `${window.location.origin}${window.location.pathname}#/post/${post.id}`;
    const shareData = { title: t('app.name'), text: post.body || t('app.name'), url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // User cancelled the native share sheet — fall through silently,
      // this isn't an error worth surfacing.
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(t('feed.linkCopied'), 'success');
    } catch {
      toast(t('common.error'), 'error');
    }
  };

  // Impression counting: each post only bumps the view counter once per
  // browser session, mirroring how X counts a viewer seeing a tweet once
  // per session rather than on every re-render/scroll-past.
  const viewedRef = useRef<Set<string>>(new Set());
  const markViewed = useCallback((postId: string) => {
    if (viewedRef.current.has(postId)) return;
    let seen: string[] = [];
    try {
      seen = JSON.parse(sessionStorage.getItem('viewed_posts') || '[]');
    } catch {
      seen = [];
    }
    if (seen.includes(postId)) {
      viewedRef.current.add(postId);
      return;
    }
    viewedRef.current.add(postId);
    seen.push(postId);
    try {
      sessionStorage.setItem('viewed_posts', JSON.stringify(seen));
    } catch {
      // sessionStorage unavailable (private mode etc.) — view just won't
      // be deduped across reloads, which is a harmless degradation.
    }
    updatePostEverywhere(postId, (p) => ({ ...p, view_count: p.view_count + 1 }));
    incrementPostView(postId).catch(() => {});
  }, [updatePostEverywhere]);

  const handleDelete = async (post: Post) => {
    if (!user || post.user_id !== user.id) return;
    if (!confirm(t('feed.deleteConfirm'))) return;
    try {
      await deletePost(post.id, user.id);
      setItems((prev) => prev.filter((it) => it.post.id !== post.id));
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
    if (!requireAuth() || !user) return;
    const body = commentText.trim();
    if (!body || !commentModal) return;
    setSendingComment(true);
    try {
      await createComment(commentModal.id, body, user.id);
      const fetched = await fetchComments(commentModal.id);
      setComments(fetched as unknown as Comment[]);
      setCommentText('');
      updatePostEverywhere(commentModal.id, (p) => ({ ...p, comment_count: p.comment_count + 1 }));
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
      {user && profile ? (
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
                <div className="relative mt-2 rounded-xl overflow-hidden border border-black/10 w-fit max-w-full">
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

              {urlMedia && (
                <div className="relative mt-2 rounded-xl overflow-hidden border border-black/10 max-w-full">
                  {urlMedia.type === 'image' ? (
                    <img src={urlMedia.url} alt="" className="max-h-48 w-full object-cover" />
                  ) : urlMedia.type === 'video' ? (
                    <video src={urlMedia.url} className="max-h-48 w-full" controls muted />
                  ) : (
                    <div className="relative w-full aspect-video bg-black/40">
                      <iframe
                        src={urlMedia.embedUrl}
                        title="preview"
                        className="absolute inset-0 h-full w-full pointer-events-none"
                        loading="lazy"
                      />
                    </div>
                  )}
                  {urlMedia.provider && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white">
                      {PROVIDER_LABEL[urlMedia.provider]}
                    </span>
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

              {showUrlField && !mediaFile && !urlMedia && (
                <div className="mt-2">
                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      inputMode="url"
                      autoFocus
                      className="input flex-1 py-2 text-xs"
                      placeholder={t('feed.urlPlaceholder')}
                      value={urlDraft}
                      onChange={(e) => { setUrlDraft(e.target.value); setUrlError(null); }}
                      onKeyDown={(e) => e.key === 'Enter' && applyUrlMedia()}
                    />
                    <button
                      type="button"
                      onClick={applyUrlMedia}
                      disabled={!urlDraft.trim()}
                      className="btn-primary px-3 py-2 text-xs shrink-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {urlError && <p className="text-[10px] text-rose-400 mt-1">{urlError}</p>}
                  <p className="text-[10px] text-slate-500 mt-1">{t('feed.urlHint')}</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={posting || !!urlMedia}
                    className="btn-ghost p-2 rounded-lg text-slate-400 hover:text-emerald-400"
                    aria-label={t('feed.addImage')}
                    title={t('feed.addImage')}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={posting || !!urlMedia}
                    className="btn-ghost p-2 rounded-lg text-slate-400 hover:text-emerald-400"
                    aria-label={t('feed.addVideo')}
                    title={t('feed.addVideo')}
                  >
                    <Video className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (mediaFile) return;
                      setShowUrlField((v) => !v);
                    }}
                    disabled={posting || !!mediaFile}
                    className={cn(
                      'btn-ghost p-2 rounded-lg hover:text-emerald-400',
                      showUrlField || urlMedia ? 'text-emerald-400' : 'text-slate-400',
                    )}
                    aria-label={t('feed.addUrl')}
                    title={t('feed.addUrl')}
                  >
                    <Link2 className="h-4 w-4" />
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
                  disabled={(!composing.trim() && !mediaFile && !urlMedia) || posting}
                  className="btn-primary py-2 px-4 text-xs"
                >
                  {posting ? <Spinner size="sm" /> : <><Plus className="h-3.5 w-3.5" /> {t('feed.post')}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => requireAuth()}
          className="card p-4 w-full flex items-center gap-3 text-left animate-slide-up hover:bg-black/5 transition-colors"
        >
          <div className="h-11 w-11 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
            <LogIn className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t('feed.signInToPost')}</p>
            <p className="text-xs text-slate-500">{t('feed.createPlaceholder')}</p>
          </div>
          <span className="btn-primary py-1.5 px-3 text-xs shrink-0">{t('feed.signInCta')}</span>
        </button>
      )}

      {/* Posts */}
      {items.length === 0 ? (
        <div className="card p-10 text-center animate-fade-in">
          <p className="text-slate-400">{t('feed.empty')}</p>
        </div>
      ) : (
        items.map((item) => (
          <PostCard
            key={item.key}
            post={item.post}
            repostedBy={item.repostedBy}
            locale={locale}
            onLike={() => handleLike(item.post)}
            onRepost={() => handleRepost(item.post)}
            onBookmark={() => handleBookmark(item.post)}
            onShare={() => handleShare(item.post)}
            onComment={() => openComments(item.post)}
            onDelete={() => handleDelete(item.post)}
            onOpenProfile={() => onOpenProfile(item.post.user_id)}
            onOpenReposter={() => item.repostedBy && onOpenProfile(item.repostedBy.id)}
            onOpenMedia={() => item.post.media_url && setLightbox({ url: item.post.media_url, type: resolveMediaType(item.post.media_type) })}
            onView={() => markViewed(item.post.id)}
            isOwner={item.post.user_id === user?.id}
            timeLabel={timeAgo(item.post.created_at, locale)}
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
      {!hasMore && items.length > 0 && (
        <p className="text-center text-xs text-slate-600 py-4">{t('feed.end')}</p>
      )}

      {/* Comment modal */}
      <Modal
        open={!!commentModal}
        onClose={() => setCommentModal(null)}
        title={t('feed.comments')}
        footer={
          user ? (
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
          ) : (
            <button onClick={() => requireAuth()} className="btn-primary w-full">
              <LogIn className="h-4 w-4" /> {t('feed.signInToInteract')}
            </button>
          )
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
  repostedBy: Post['author'] | null;
  locale: 'tr' | 'en';
  onLike: () => void;
  onRepost: () => void;
  onBookmark: () => void;
  onShare: () => void;
  onComment: () => void;
  onDelete: () => void;
  onOpenProfile: () => void;
  onOpenReposter: () => void;
  onOpenMedia: () => void;
  onView: () => void;
  isOwner: boolean;
  timeLabel: string;
}

function PostCard({
  post, repostedBy, onLike, onRepost, onBookmark, onShare, onComment, onDelete, onOpenProfile, onOpenReposter, onOpenMedia, onView, isOwner, timeLabel,
}: PostCardProps) {
  const articleRef = useRef<HTMLElement>(null);
  const { t } = useSettings();

  // X/Twitter yalnızca bir gönderi gerçekten görünüme girdiğinde
  // "görüntülenme" sayısını artırır — mount anında değil.
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onView();
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  return (
    <article ref={articleRef} className="card p-4 animate-slide-up">
      {repostedBy && (
        <button
          onClick={onOpenReposter}
          className="flex items-center gap-1.5 mb-2 -mt-0.5 text-[11px] font-semibold text-slate-500 hover:text-emerald-400 transition-colors"
        >
          <Repeat2 className="h-3.5 w-3.5" />
          {repostedBy.display_name} {t('feed.repostedBy')}
        </button>
      )}
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
        <PostMedia url={post.media_url} type={resolveMediaType(post.media_type)} onOpen={onOpenMedia} />
      )}

      {/* Eylem çubuğu — X/Twitter ile birebir aynı sıra: yorum, repost,
          beğeni, görüntülenme (pasif istatistik), kaydet + paylaş. */}
      <div className="flex items-center justify-between mt-3 -mx-1">
        <button
          onClick={onComment}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-all active:scale-90"
        >
          <MessageCircle className="h-4 w-4" />
          {formatNumber(post.comment_count)}
        </button>

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

        <div className="flex items-center gap-0.5">
          <button
            onClick={onBookmark}
            className={cn(
              'p-1.5 rounded-lg transition-all active:scale-90',
              post.bookmarked_by_me ? 'text-sky-400 bg-sky-500/10' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-500/10',
            )}
          >
            <Bookmark className={cn('h-4 w-4', post.bookmarked_by_me && 'fill-sky-400')} />
          </button>
          <button
            onClick={onShare}
            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-all active:scale-90"
          >
            <ShareIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
