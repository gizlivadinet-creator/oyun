import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners = new Set<(t: ToastData) => void>();

export function toast(message: string, type: ToastType = 'info') {
  const data: ToastData = { id: ++toastId, message, type };
  listeners.forEach((l) => l(data));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const listener = (t: ToastData) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3200);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return createPortal(
    <div className="fixed top-4 inset-x-0 z-[60] flex flex-col items-center gap-2 pointer-events-none safe-top">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl animate-slide-up max-w-[90%] text-center',
            t.type === 'success' && 'bg-emerald-500 text-slate-950',
            t.type === 'error' && 'bg-rose-500 text-white',
            t.type === 'info' && 'glass-strong text-slate-100',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  );
}

export type { ReactNode };
