import { cn } from '@/lib/utils';
import { TIER_COLORS } from '@/lib/xp';
import {
  Award, Footprints, MessageCircle, Heart, MessageSquare,
  Flame, TrendingUp, Users, Crown,
} from 'lucide-react';
import type { Badge } from '@/lib/types';

interface BadgeChipProps {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg';
  earned?: boolean;
  locale?: 'tr' | 'en';
}

const BADGE_ICONS: Record<string, typeof Award> = {
  Footprints, MessageCircle, Heart, MessageSquare, Flame,
  TrendingUp, Users, Crown, Award,
};

const SIZES = {
  sm: { box: 'h-12 w-12', icon: 'h-6 w-6', label: 'text-[10px]' },
  md: { box: 'h-16 w-16', icon: 'h-8 w-8', label: 'text-xs' },
  lg: { box: 'h-20 w-20', icon: 'h-10 w-10', label: 'text-sm' },
} as const;

export function BadgeChip({ badge, size = 'md', earned = true, locale = 'tr' }: BadgeChipProps) {
  const colors = TIER_COLORS[badge.tier] ?? TIER_COLORS.bronze;
  const IconComp = BADGE_ICONS[badge.icon] ?? Award;
  const name = locale === 'tr' ? badge.name_tr : badge.name_en;
  const desc = locale === 'tr' ? badge.description_tr : badge.description_en;

  return (
    <div className="flex flex-col items-center gap-1.5 group">
      <div
        title={desc}
        className={cn(
          'relative rounded-2xl flex items-center justify-center transition-all',
          SIZES[size].box,
          earned
            ? cn('glass ring-1', colors.ring, colors.glow, 'shadow-lg')
            : 'bg-slate-800/50 border border-dashed border-slate-700',
          earned && 'hover:scale-105',
        )}
      >
        <IconComp className={cn(SIZES[size].icon, earned ? colors.text : 'text-slate-600')} />
        {earned && (
          <span className={cn('absolute -top-1 -right-1 chip text-[8px] px-1.5 py-0.5', colors.text, 'bg-slate-950/80')}>
            {colors.label}
          </span>
        )}
      </div>
      <span className={cn(SIZES[size].label, 'font-semibold text-center max-w-[80px] truncate', earned ? 'text-slate-200' : 'text-slate-600')}>
        {name}
      </span>
    </div>
  );
}
