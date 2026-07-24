import { cn, initials, avatarGradient } from '@/lib/utils';

interface AvatarProps {
  id: string;
  name: string;
  url?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  ring?: boolean;
  className?: string;
}

const SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
  '2xl': 'h-28 w-28 text-3xl',
};

export function Avatar({ id, name, url, size = 'md', ring, className }: AvatarProps) {
  return (
    <div
      className={cn(
        'relative shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold text-white',
        avatarGradient(id),
        SIZES[size],
        ring && 'ring-2 ring-emerald-500/60 ring-offset-2 ring-offset-slate-950',
        className,
      )}
    >
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}
