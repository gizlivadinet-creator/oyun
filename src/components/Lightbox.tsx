import { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { parseMediaUrl } from '@/lib/mediaEmbed';

export interface LightboxItem {
  url: string;
  type: 'image' | 'video' | 'embed';
}

interface LightboxProps {
  item: LightboxItem | null;
  onClose: () => void;
}

/**
 * Fullscreen media viewer for post attachments.
 * - Images: click/tap to zoom in/out, drag to pan while zoomed, double-click to reset.
 * - Videos: native controls, autoplay (muted-friendly), loops.
 * - Escape key or backdrop click closes it.
 */
export function Lightbox({ item, onClose }: LightboxProps) {
  const [zoomed, setZoomed] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number; dragging: boolean } | null>(null);

  useEffect(() => {
    setZoomed(false);
    setPos({ x: 0, y: 0 });
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [item, onClose]);

  if (!item) return null;

  const toggleZoom = () => {
    setZoomed((z) => !z);
    setPos({ x: 0, y: 0 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!zoomed) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, dragging: true };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s?.dragging) return;
    setPos({ x: s.origX + (e.clientX - s.startX), y: s.origY + (e.clientY - s.startY) });
  };
  const onPointerUp = () => {
    if (dragState.current) dragState.current.dragging = false;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />

      <div className="relative z-10 w-full h-full flex items-center justify-center p-4 safe-top safe-bottom">
        {item.type === 'embed' ? (
          <EmbedFrame url={item.url} />
        ) : item.type === 'image' ? (
          <img
            src={item.url}
            alt=""
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={toggleZoom}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className="max-h-full max-w-full object-contain rounded-lg select-none transition-transform duration-200"
            style={{
              transform: `scale(${zoomed ? 2 : 1}) translate(${pos.x / (zoomed ? 2 : 1)}px, ${pos.y / (zoomed ? 2 : 1)}px)`,
              cursor: zoomed ? 'grab' : 'zoom-in',
              touchAction: 'none',
            }}
          />
        ) : (
          <video
            src={item.url}
            controls
            autoPlay
            playsInline
            loop
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg outline-none"
          />
        )}
      </div>

      {/* Top action bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-end gap-2 p-4 safe-top">
        {item.type === 'image' && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleZoom(); }}
            className="rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
            aria-label={zoomed ? 'Uzaklaştır' : 'Yakınlaştır'}
          >
            {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
          </button>
        )}
        {item.type !== 'embed' && (
          <a
            href={item.url}
            download
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
            aria-label="İndir"
          >
            <Download className="h-5 w-5" />
          </a>
        )}
        {item.type === 'embed' && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-full bg-black/50 px-3 py-2.5 text-xs font-semibold text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
          >
            Kaynakta aç
          </a>
        )}
        <button
          onClick={onClose}
          className="rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
          aria-label="Kapat"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function EmbedFrame({ url }: { url: string }) {
  const parsed = parseMediaUrl(url);
  if (!parsed?.embedUrl) {
    return <p className="text-sm text-slate-300">Bu içerik görüntülenemiyor.</p>;
  }
  return (
    <div
      className="relative w-full max-w-3xl aspect-video rounded-lg overflow-hidden bg-black"
      onClick={(e) => e.stopPropagation()}
    >
      <iframe
        src={parsed.embedUrl}
        title="embed"
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
      />
    </div>
  );
}
