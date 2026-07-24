import { useEffect, useState, useCallback } from 'react';
import { Target, Zap, Coins, Check, Gift, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Spinner } from '@/components/Spinner';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import { fetchMissionsWithProgress } from '@/lib/services';
import { claimMissionReward } from '@/lib/missions';
import type { MissionWithProgress } from '@/lib/types';

export function MissionsPage() {
  const { profile, refreshProfile } = useAuth();
  const { t, locale } = useSettings();
  const [daily, setDaily] = useState<MissionWithProgress[]>([]);
  const [weekly, setWeekly] = useState<MissionWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const { daily: d, weekly: w } = await fetchMissionsWithProgress(profile.id);
      setDaily(d);
      setWeekly(w);
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [profile, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClaim = async (m: MissionWithProgress) => {
    if (!profile || !m.user_mission) return;
    setClaiming(m.id);
    try {
      const updated = await claimMissionReward(m.user_mission, m, profile.id);
      if (updated) {
        await refreshProfile();
        await load();
      }
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Spinner size="lg" />
      </div>
    );
  }

  const totalDaily = daily.length;
  const completedDaily = daily.filter((m) => m.completed).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Target className="h-5 w-5 text-emerald-400" /> {t('mission.title')}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {completedDaily} / {totalDaily} {t('mission.completed').toLowerCase()}
        </p>
      </div>

      {/* Daily missions */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-bold">{t('mission.daily')}</h2>
          <span className="text-[10px] text-slate-500 ml-auto">{t('mission.resetsIn')} 24s</span>
        </div>
        <div className="space-y-3">
          {daily.length === 0 ? (
            <div className="card p-6 text-center text-sm text-slate-500">{t('mission.empty')}</div>
          ) : (
            daily.map((m) => (
              <MissionCard
                key={m.id}
                mission={m}
                locale={locale}
                claiming={claiming === m.id}
                onClaim={() => handleClaim(m)}
                t={t}
              />
            ))
          )}
        </div>
      </section>

      {/* Weekly missions */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-bold">{t('mission.weekly')}</h2>
        </div>
        <div className="space-y-3">
          {weekly.length === 0 ? (
            <div className="card p-6 text-center text-sm text-slate-500">{t('mission.empty')}</div>
          ) : (
            weekly.map((m) => (
              <MissionCard
                key={m.id}
                mission={m}
                locale={locale}
                claiming={claiming === m.id}
                onClaim={() => handleClaim(m)}
                t={t}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

interface MissionCardProps {
  mission: MissionWithProgress;
  locale: 'tr' | 'en';
  claiming: boolean;
  onClaim: () => void;
  t: (k: string) => string;
}

function MissionCard({ mission, locale, claiming, onClaim, t }: MissionCardProps) {
  const title = locale === 'tr' ? mission.title_tr : mission.title_en;
  const desc = locale === 'tr' ? mission.description_tr : mission.description_en;
  const percent = Math.min(100, Math.round((mission.progress / mission.target) * 100));
  const canClaim = mission.completed && !mission.claimed;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
        </div>
        {mission.claimed && (
          <span className="chip bg-emerald-500/15 text-emerald-400 shrink-0">
            <Check className="h-3 w-3" /> {t('mission.claimed')}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
          <span>{mission.progress} / {mission.target}</span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              mission.completed ? 'gradient-emerald' : 'bg-slate-600',
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <Zap className="h-3.5 w-3.5" /> +{mission.xp_reward}
          </span>
          <span className="flex items-center gap-1 text-amber-400 font-semibold">
            <Coins className="h-3.5 w-3.5" /> +{mission.coin_reward}
          </span>
        </div>
        {canClaim && (
          <button onClick={onClaim} disabled={claiming} className="btn-primary py-1.5 px-3 text-xs">
            {claiming ? <Spinner size="sm" /> : <><Gift className="h-3.5 w-3.5" /> {t('mission.claim')}</>}
          </button>
        )}
      </div>
    </div>
  );
}
