import { Globe, Crown, Info, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Avatar } from '@/components/Avatar';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const { profile, signOut } = useAuth();
  const { locale, setLocale, t } = useSettings();

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold">{t('settings.title')}</h1>

      {/* Profile card */}
      <div className="card p-4 flex items-center gap-3">
        <Avatar id={profile?.id ?? ''} name={profile?.display_name ?? ''} url={profile?.avatar_url} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{profile?.display_name}</p>
          <p className="text-xs text-slate-400">Lv.{profile?.level} · {profile?.xp} XP</p>
        </div>
        {profile?.is_premium && (
          <span className="chip gradient-gold text-slate-950 text-[10px]">★ Premium</span>
        )}
      </div>

      {/* Language */}
      <section className="card overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 border-b border-white/5">
          <Globe className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-bold">{t('settings.language')}</h2>
        </div>
        <div className="p-2">
          {(['tr', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={cn(
                'flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-all',
                locale === l ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-300 hover:bg-white/5',
              )}
            >
              <span className="font-medium">{l === 'tr' ? t('settings.turkish') : t('settings.english')}</span>
              {locale === l && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
            </button>
          ))}
        </div>
      </section>

      {/* Premium */}
      <section className="card overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 border-b border-white/5">
          <Crown className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-bold">{t('settings.premium')}</h2>
        </div>
        <div className="p-4">
          {profile?.is_premium ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-400 font-semibold">{t('settings.active')}</span>
              <span className="chip gradient-gold text-slate-950">★</span>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-400 mb-3">
                Premium üyelik; özel çerçeveler, gelişmiş istatistikler ve günlük bonus coin sunar.
              </p>
              <button className="btn-primary w-full">
                <Crown className="h-4 w-4" /> Premium'a Yüksel
              </button>
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section className="card overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2 border-b border-white/5">
          <Info className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-bold">{t('settings.about')}</h2>
        </div>
        <div className="p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">{t('settings.version')}</span>
            <span className="font-mono text-slate-300">1.0.0</span>
          </div>
        </div>
      </section>

      {/* Sign out */}
      <button
        onClick={async () => {
          await signOut();
          toast(t('auth.signOut'), 'info');
        }}
        className="btn-danger w-full"
      >
        <LogOut className="h-4 w-4" /> {t('auth.signOut')}
      </button>

      <p className="text-center text-[10px] text-slate-600 pt-2">
        {t('app.name')} · {t('app.tagline')}
      </p>
    </div>
  );
}
