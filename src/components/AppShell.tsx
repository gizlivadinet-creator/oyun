import { useEffect, useState, lazy, Suspense } from 'react';
import { Home, Compass, Target, Trophy, User as UserIcon, Bell, Settings as SettingsIcon, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { cn } from '@/lib/utils';
import { fetchUnreadNotificationCount } from '@/lib/services';
import { Spinner } from '@/components/Spinner';

const FeedPage = lazy(() => import('@/pages/FeedPage').then((m) => ({ default: m.FeedPage })));
const ExplorePage = lazy(() => import('@/pages/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const MissionsPage = lazy(() => import('@/pages/MissionsPage').then((m) => ({ default: m.MissionsPage })));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));

type Tab = 'feed' | 'explore' | 'missions' | 'ranks' | 'profile';
type Screen = Tab | 'settings' | 'notifications' | 'admin';

export function AppShell() {
  const { profile } = useAuth();
  const { t } = useSettings();
  const [screen, setScreen] = useState<Screen>('feed');
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!profile) return;
    fetchUnreadNotificationCount(profile.id).then(setUnread).catch(() => {});
    const interval = setInterval(() => {
      fetchUnreadNotificationCount(profile.id).then(setUnread).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  const openProfile = (id: string) => {
    setViewProfileId(id);
    setScreen('profile');
  };

  const goFeed = () => { setViewProfileId(null); setScreen('feed'); };

  const tabs: Array<{ id: Tab; icon: typeof Home; label: string }> = [
    { id: 'feed', icon: Home, label: t('nav.feed') },
    { id: 'explore', icon: Compass, label: t('nav.explore') },
    { id: 'missions', icon: Target, label: t('nav.missions') },
    { id: 'ranks', icon: Trophy, label: t('nav.ranks') },
    { id: 'profile', icon: UserIcon, label: t('nav.profile') },
  ];

  const showBottomNav = !['settings', 'notifications', 'admin'].includes(screen);
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto relative">
      {/* Top bar */}
      <header className="sticky top-0 z-30 glass-strong safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          {screen === 'settings' || screen === 'notifications' || screen === 'admin' ? (
            <button
              onClick={() => setScreen('feed')}
              className="btn-ghost px-2 py-1 -ml-2 text-sm"
            >
              ← {t('common.back')}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-emerald flex items-center justify-center">
                <span className="text-slate-950 font-bold text-sm">S</span>
              </div>
              <span className="font-bold text-sm">{t('app.name')}</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => setScreen('notifications')}
              className="relative btn-ghost p-2 rounded-lg"
              aria-label={t('nav.notifications')}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pop">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {isAdmin && (
              <button
                onClick={() => setScreen('admin')}
                className={cn('btn-ghost p-2 rounded-lg', screen === 'admin' && 'bg-emerald-500/10 text-emerald-400')}
                aria-label={t('nav.admin')}
              >
                <Shield className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => setScreen('settings')}
              className={cn('btn-ghost p-2 rounded-lg', screen === 'settings' && 'bg-emerald-500/10 text-emerald-400')}
              aria-label={t('nav.settings')}
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-24 pt-3">
        <Suspense fallback={<div className="flex justify-center py-20"><Spinner size="lg" /></div>}>
          {screen === 'feed' && <FeedPage onOpenProfile={openProfile} />}
          {screen === 'explore' && <ExplorePage onOpenProfile={openProfile} />}
          {screen === 'missions' && <MissionsPage />}
          {screen === 'ranks' && <LeaderboardPage onOpenProfile={openProfile} />}
          {screen === 'profile' && (
            <ProfilePage
              profileId={viewProfileId ?? profile?.id ?? ''}
              onOpenProfile={openProfile}
              onBack={goFeed}
            />
          )}
          {screen === 'settings' && <SettingsPage />}
          {screen === 'notifications' && <NotificationsPage onOpenProfile={openProfile} />}
          {screen === 'admin' && isAdmin && <AdminPage />}
          {screen === 'admin' && !isAdmin && (
            <div className="text-center py-20 text-slate-400">{t('admin.restricted')}</div>
          )}
        </Suspense>
      </main>

      {/* Bottom navigation */}
      {showBottomNav && (
        <nav className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto glass-strong safe-bottom border-t border-white/10">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = screen === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'profile') setViewProfileId(null);
                    setScreen(tab.id);
                  }}
                  className={cn('nav-item', active ? 'text-emerald-400' : 'text-slate-500')}
                >
                  <Icon className={cn('h-5 w-5 transition-transform', active && 'scale-110')} />
                  <span>{tab.label}</span>
                  {active && (
                    <span className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
