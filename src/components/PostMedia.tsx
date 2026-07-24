import { Maximize2, Play } from 'lucide-react';
import { parseMediaUrl, PROVIDER_LABEL, type ParsedMedia } from '@/lib/mediaEmbed';

interface PostMediaProps {
  url: string;
  type: 'image' | 'video' | 'embed';
  onOpen: () => void;
}

export function PostMedia({ url, type, onOpen }: PostMediaProps) {
  if (type === 'embed') {
    const parsed: ParsedMedia | null = parseMediaUrl(url);
    if (!parsed?.embedUrl) return null;
    return (
      <div className="relative mt-3 w-full overflow-hidden rounded-xl border border-white/5 bg-black/40 group">
        <div className="relative w-full aspect-video">
          <iframe
            src={parsed.embedUrl}
            title={parsed.provider ? PROVIDER_LABEL[parsed.provider] : 'embed'}
            className="absolute inset-0 h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          />
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white opacity-80 hover:opacity-100 transition-opacity backdrop-blur-sm"
          aria-label="Tam ekran aç"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        {parsed.provider && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {PROVIDER_LABEL[parsed.provider]}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={type === 'image' ? 'Görseli büyüt' : 'Videoyu oynat'}
      className="relative mt-3 w-full overflow-hidden rounded-xl border border-white/5 bg-black/20 block group"
    >
      {type === 'image' ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="w-full max-h-[420px] object-cover transition-transform duration-300 group-active:scale-[0.98]"
        />
      ) : (
        <div className="relative">
          <video src={url} className="w-full max-h-[420px] object-cover" muted playsInline preload="metadata" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-active:bg-black/30 transition-colors">
            <span className="flex items-center justify-center h-12 w-12 rounded-full bg-black/50 backdrop-blur-sm">
              <Play className="h-5 w-5 text-white fill-white ml-0.5" />
            </span>
          </div>
        </div>
      )}
    </button>
  );
}
