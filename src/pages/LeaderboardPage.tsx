import { useEffect, useState, useCallback } from 'react';
import { Trophy, Crown, Medal, Globe, MapPin, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/Spinner';
import { cn, formatNumber } from '@/lib/utils';
import { fetchLeaderboard } from '@/lib/services';
import type { Profile } from '@/lib/types';

type Scope = 'global' | 'country' | 'friends';

interface LeaderboardPageProps {
  onOpenProfile: (id: string) => void;
}

export function LeaderboardPage({ onOpenProfile }: LeaderboardPageProps) {
  const { profile } = useAuth();
  const { t } = useSettings();
  const [scope, setScope] = useState<Scope>('global');
  const [leaders, setLeaders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const result = await fetchLeaderboard(scope, profile.id);
      setLeaders(result);
    } catch {
      setLeaders([]);
    } finally {
      setLoading(false);
    }
  }, [profile, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: Array<{ id: Scope; icon: typeof Globe; label: string }> = [
    { id: 'global', icon: Globe, label: t('rank.global') },
    { id: 'country', icon: MapPin, label: t('rank.country') },
    { id: 'friends', icon: Users, label: t('rank.friends') },
  ];

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" /> {t('rank.title')}
        </h1>
      </div>

      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setScope(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all',
                scope === tab.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : leaders.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-slate-500">{t('rank.empty')}</p>
        </div>
      ) : (
        <>
          {top3.length >= 2 && (
            <div className="grid grid-cols-3 gap-2 items-end">
              {top3[1] && (
                <PodiumItem rank={2} profile={top3[1]} isMe={top3[1].id === profile?.id} height="h-24" youLabel={t('rank.you')} onClick={() => onOpenProfile(top3[1].id)} />
              )}
              {top3[0] && (
                <PodiumItem rank={1} profile={top3[0]} isMe={top3[0].id === profile?.id} height="h-32" youLabel={t('rank.you')} onClick={() => onOpenProfile(top3[0].id)} />
              )}
              {top3[2] && (
                <PodiumItem rank={3} profile={top3[2]} isMe={top3[2].id === profile?.id} height="h-20" youLabel={t('rank.you')} onClick={() => onOpenProfile(top3[2].id)} />
              )}
            </div>
          )}

          <div className="space-y-2">
            {rest.map((p, i) => {
              const rank = i + 4;
              const isMe = p.id === profile?.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onOpenProfile(p.id)}
                  className={cn(
                    'card p-3 flex items-center gap-3 w-full text-left transition-all hover:bg-black/5',
                    isMe && 'ring-1 ring-emerald-500/40',
                  )}
                >
                  <span className="w-6 text-center text-sm font-bold text-slate-400 tabular-nums">{rank}</span>
                  <Avatar id={p.id} name={p.display_name} url={p.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {p.display_name} {isMe && <span className="text-emerald-400">({t('rank.you')})</span>}
                    </p>
                    <p className="text-[10px] text-slate-500">Lv.{p.level} · {formatNumber(p.xp)} XP</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 tabular-nums">{formatNumber(p.xp)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface PodiumItemProps {
  rank: number;
  profile: Profile;
  isMe: boolean;
  height: string;
  youLabel: string;
  onClick: () => void;
}

function PodiumItem({ rank, profile: p, isMe, height, youLabel, onClick }: PodiumItemProps) {
  const colors = {
    1: { bg: 'gradient-gold', Icon: Crown, iconColor: 'text-amber-300' },
    2: { bg: 'bg-gradient-to-b from-zinc-300 to-zinc-500', Icon: Medal, iconColor: 'text-zinc-100' },
    3: { bg: 'bg-gradient-to-b from-amber-600 to-amber-800', Icon: Medal, iconColor: 'text-amber-300' },
  }[rank]!;

  const { Icon, bg, iconColor } = colors;

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <Avatar id={p.id} name={p.display_name} url={p.avatar_url} size={rank === 1 ? 'lg' : 'md'} ring={isMe} />
        <span className={cn('absolute -top-2 -left-2 h-6 w-6 rounded-full flex items-center justify-center text-black/70', bg)}>
          <Icon className={cn('h-3.5 w-3.5', iconColor)} />
        </span>
      </div>
      <p className="text-xs font-semibold truncate max-w-[80px]">
        {isMe ? youLabel : p.display_name.split(' ')[0]}
      </p>
      <p className="text-[10px] text-emerald-400 font-bold tabular-nums">{formatNumber(p.xp)}</p>
      <div className={cn('w-full rounded-t-lg flex items-center justify-center', height, bg)}>
        <span className="text-lg font-black text-black/70">{rank}</span>
      </div>
    </button>
  );
}
