import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Optional footer (e.g. Save/Cancel buttons) that stays pinned to the
   * bottom of the modal and is always visible, even while the body content
   * scrolls. This is what fixes the "Save button not visible on mobile"
   * issue — long content used to be able to push the buttons below the
   * fold with no obvious way to reach them. */
  footer?: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          // Use dvh (dynamic viewport height) instead of vh so mobile browser
          // chrome (address bar / bottom toolbar) is accounted for — with
          // plain vh the modal could be taller than what's actually visible,
          // pushing the footer buttons off-screen with no visible way to
          // reach them.
          'relative w-full sm:max-w-md glass-strong rounded-t-3xl sm:rounded-3xl animate-slide-up',
          'flex flex-col max-h-[85dvh] sm:max-h-[85vh]',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
            <h2 className="text-lg font-bold">{title}</h2>
            <button onClick={onClose} className="btn-ghost p-2 -mr-2 rounded-lg" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className={cn('flex-1 min-h-0 overflow-y-auto px-5', title ? '' : 'pt-5')}>
          {children}
          {!footer && <div className="h-5" />}
        </div>

        {footer && (
          <div className="shrink-0 px-5 pt-3 pb-5 safe-bottom border-t border-white/5 mt-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
