import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

export function Spinner({ size = 'md', className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin',
        SIZES[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullScreenSpinner({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-950">
      <Spinner size="lg" />
      {label && <p className="text-sm text-slate-400">{label}</p>}
    </div>
  );
}
