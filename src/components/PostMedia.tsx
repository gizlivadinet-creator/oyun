import { Play } from 'lucide-react';

interface PostMediaProps {
  url: string;
  type: 'image' | 'video';
  onOpen: () => void;
}

export function PostMedia({ url, type, onOpen }: PostMediaProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
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
