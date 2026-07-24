/**
 * URL-based media detection for the post composer.
 *
 * A user pastes a plain URL (image link, or a link to a video on YouTube,
 * Vimeo, Dailymotion, Facebook, Instagram or TikTok, or a direct video file
 * link) and we figure out:
 *  - how to store it (`type`: 'image' | 'video' | 'embed')
 *  - if it's a known platform, the sandboxed iframe `embedUrl` to render it
 *  - a human-readable `provider` label for the UI
 */

export type MediaKind = 'image' | 'video' | 'embed';

export interface ParsedMedia {
  type: MediaKind;
  /** Original URL the user pasted — always kept as the source of truth. */
  url: string;
  /** Only set when type === 'embed': the iframe src to render. */
  embedUrl?: string;
  provider?: 'youtube' | 'vimeo' | 'dailymotion' | 'facebook' | 'instagram' | 'tiktok';
}

const VIDEO_FILE_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i;

function safeUrl(input: string): URL | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

export function parseMediaUrl(input: string): ParsedMedia | null {
  const url = input.trim();
  const u = safeUrl(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();

  // --- YouTube ---
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    let id = '';
    if (host === 'youtu.be') {
      id = u.pathname.slice(1);
    } else if (u.pathname.startsWith('/shorts/')) {
      id = u.pathname.split('/')[2] ?? '';
    } else if (u.pathname.startsWith('/embed/')) {
      id = u.pathname.split('/')[2] ?? '';
    } else {
      id = u.searchParams.get('v') ?? '';
    }
    id = id.split('&')[0].split('?')[0];
    if (id) {
      return { type: 'embed', url, provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
  }

  // --- Vimeo ---
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const match = u.pathname.match(/(\d{6,})/);
    if (match) {
      return { type: 'embed', url, provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${match[1]}` };
    }
  }

  // --- Dailymotion ---
  if (host === 'dailymotion.com' || host === 'dai.ly') {
    let id = '';
    if (host === 'dai.ly') {
      id = u.pathname.slice(1);
    } else {
      const m = u.pathname.match(/\/video\/([a-zA-Z0-9]+)/);
      id = m ? m[1] : '';
    }
    if (id) {
      return { type: 'embed', url, provider: 'dailymotion', embedUrl: `https://www.dailymotion.com/embed/video/${id}` };
    }
  }

  // --- Facebook (video posts, reels, fb.watch) ---
  if (host === 'facebook.com' || host === 'fb.watch' || host === 'm.facebook.com') {
    return {
      type: 'embed',
      url,
      provider: 'facebook',
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=false`,
    };
  }

  // --- Instagram (posts, reels) ---
  if (host === 'instagram.com') {
    const m = u.pathname.match(/\/(p|reel|tv)\/([^/]+)/);
    if (m) {
      const clean = `https://www.instagram.com/${m[1]}/${m[2]}/`;
      return { type: 'embed', url, provider: 'instagram', embedUrl: `${clean}embed` };
    }
  }

  // --- TikTok ---
  if (host === 'tiktok.com' || host === 'vm.tiktok.com') {
    const m = u.pathname.match(/\/video\/(\d+)/);
    if (m) {
      return { type: 'embed', url, provider: 'tiktok', embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}` };
    }
    // Shortened vm.tiktok.com links can't be resolved to an ID client-side
    // without following the redirect (which needs a network round trip we
    // don't want to do here) — fall through and let it be treated as a
    // regular link/image attempt below.
  }

  // --- Direct video file link ---
  if (VIDEO_FILE_EXT.test(u.pathname)) {
    return { type: 'video', url };
  }

  // Anything else (a direct image file link, or an unrecognized URL) is
  // treated as an image — the most common case for a pasted picture link.
  // It degrades gracefully: if it turns out not to be an image, the <img>
  // tag simply fails to render and the user sees a clear "invalid" state.
  return { type: 'image', url };
}

export const PROVIDER_LABEL: Record<NonNullable<ParsedMedia['provider']>, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  dailymotion: 'Dailymotion',
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

/** Safely narrows a DB `media_type` column value (which may be null/unknown) to a MediaKind, defaulting to 'image'. */
export function resolveMediaType(type: string | null | undefined): MediaKind {
  if (type === 'video') return 'video';
  if (type === 'embed') return 'embed';
  return 'image';
}
