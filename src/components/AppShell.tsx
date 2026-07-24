import { useEffect, useState, lazy, Suspense } from 'react';
import { Home, Compass, Target, Trophy, User as UserIcon, Bell, Settings as SettingsIcon, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { cn } from '@/lib/utils';
import { fetchUnreadNotificationCount } from '@/lib/services';
import { Spinner } from '@/components/Spinner';
import { useRouter, resolveRoute } from '@/lib/router';
import { routes, NOT_FOUND_ROUTE } from '@/lib/routes';

const FeedPage = lazy(() => import('@/pages/FeedPage').then((m) => ({ default: m.FeedPage })));
const ExplorePage = lazy(() => import('@/pages/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const MissionsPage = lazy(() => import('@/pages/MissionsPage').then((m) => ({ default: m.MissionsPage })));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const ComingSoonPage = lazy(() => import('@/pages/ComingSoonPage').then((m) => ({ default: m.ComingSoonPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const ServerErrorPage = lazy(() => import('@/pages/ServerErrorPage').then((m) => ({ default: m.ServerErrorPage })));
const OfflinePage = lazy(() => import('@/pages/OfflinePage').then((m) => ({ default: m.OfflinePage })));

type Tab = 'feed' | 'explore' | 'missions' | 'ranks' | 'profile';

const TAB_PATH: Record<Tab, string> = {
  feed: '/feed',
  explore: '/explore',
  missions: '/missions',
  ranks: '/leaderboard',
  profile: '/profile',
};

export function AppShell() {
  const { profile } = useAuth();
  const { t } = useSettings();
  const { path, navigate } = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!profile) return;
    fetchUnreadNotificationCount(profile.id).then(setUnread).catch(() => {});
    const interval = setInterval(() => {
      fetchUnreadNotificationCount(profile.id).then(setUnread).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  const matched = resolveRoute(routes, path) ?? { route: NOT_FOUND_ROUTE, params: {} };
  const { route, params } = matched;
  const screen = route.screen;

  useEffect(() => {
    // Zaten oturum açmış bir kullanıcı /auth/* rotalarına girerse akışa yönlendir.
    if (screen === 'auth') navigate('/feed', { replace: true });
  }, [screen, navigate]);

  const openProfile = (id: string) => navigate(`/u/${id}`);
  const goFeed = () => navigate('/feed');
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else navigate('/feed');
  };

  const tabs: Array<{ id: Tab; icon: typeof Home; label: string }> = [
    { id: 'feed', icon: Home, label: t('nav.feed') },
    { id: 'explore', icon: Compass, label: t('nav.explore') },
    { id: 'missions', icon: Target, label: t('nav.missions') },
    { id: 'ranks', icon: Trophy, label: t('nav.ranks') },
    { id: 'profile', icon: UserIcon, label: t('nav.profile') },
  ];

  const showBottomNav = !!route.tab;
  const showBackButton = !showBottomNav && screen !== 'auth';
  const isAdmin = profile?.role === 'admin';

  // /profile -> kendi profilim, /u/:handle -> ilgili kullanıcı
  const profileHandle = params.handle ?? profile?.id ?? '';

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto relative">
      {/* Top bar */}
      <header className="sticky top-0 z-30 glass-strong safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          {showBackButton ? (
            <button onClick={goBack} className="btn-ghost px-2 py-1 -ml-2 text-sm">
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
              onClick={() => navigate('/notifications')}
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
                onClick={() => navigate('/admin')}
                className={cn('btn-ghost p-2 rounded-lg', screen === 'admin' && 'bg-emerald-500/10 text-emerald-400')}
                aria-label={t('nav.admin')}
              >
                <Shield className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => navigate('/settings')}
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
              profileId={profileHandle}
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
          {screen === 'coming-soon' && <ComingSoonPage label={route.labelKey ? t(route.labelKey) : undefined} />}
          {screen === 'not-found' && <NotFoundPage />}
          {screen === 'server-error' && <ServerErrorPage />}
          {screen === 'offline' && <OfflinePage />}
        </Suspense>
      </main>

      {/* Bottom navigation */}
      {showBottomNav && (
        <nav className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto glass-strong safe-bottom border-t border-black/10">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = route.tab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(TAB_PATH[tab.id])}
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
