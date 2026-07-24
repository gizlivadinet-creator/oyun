import { cn } from '@/lib/utils';
import { xpProgress } from '@/lib/xp';

interface XpBarProps {
  xp: number;
  showText?: boolean;
  className?: string;
}

export function XpBar({ xp, showText = true, className }: XpBarProps) {
  const { level, percent, intoLevel, span, toNext } = xpProgress(xp);

  return (
    <div className={cn('w-full', className)}>
      {showText && (
        <div className="flex items-center justify-between mb-1.5 text-xs">
          <span className="font-bold text-emerald-400">{level}. Seviye</span>
          <span className="text-slate-400 tabular-nums">
            {intoLevel} / {span} XP
          </span>
        </div>
      )}
      <div className="relative h-2.5 rounded-full bg-slate-800 overflow-hidden xp-bar">
        <div
          className="absolute inset-y-0 left-0 rounded-full gradient-emerald transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showText && (
        <p className="mt-1 text-[10px] text-slate-500 tabular-nums">
          {toNext} XP sonraki seviyeye
        </p>
      )}
    </div>
  );
}
