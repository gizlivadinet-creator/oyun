/**
 * Uygulamanın tüm URL yapısı burada tanımlanır.
 * `screen` alanı AppShell'in hangi bileşeni/alt navigasyonu göstereceğini belirler.
 * Henüz gerçek sayfası olmayan rotalar `coming-soon` screen'ine düşer;
 * böylece URL yapısı ileride yeni modüller eklenebilecek şekilde ölçeklenebilir kalır.
 */

export type ScreenId =
  | 'feed'
  | 'explore'
  | 'missions'
  | 'ranks'
  | 'profile'
  | 'settings'
  | 'notifications'
  | 'admin'
  | 'auth'
  | 'offline'
  | 'not-found'
  | 'server-error'
  | 'coming-soon';

export interface RouteDef {
  pattern: string;
  screen: ScreenId;
  /** Alt gezinme çubuğunda vurgulanacak sekme (varsa) */
  tab?: 'feed' | 'explore' | 'missions' | 'ranks' | 'profile';
  /** coming-soon ekranında gösterilecek özel etiket anahtarı */
  labelKey?: string;
}

export const routes: RouteDef[] = [
  { pattern: '/', screen: 'feed', tab: 'feed' },
  { pattern: '/feed', screen: 'feed', tab: 'feed' },
  { pattern: '/explore', screen: 'explore', tab: 'explore' },
  { pattern: '/discover', screen: 'coming-soon', labelKey: 'nav.discover' },
  { pattern: '/search', screen: 'coming-soon', labelKey: 'nav.search' },
  { pattern: '/notifications', screen: 'notifications' },
  { pattern: '/messages', screen: 'coming-soon', labelKey: 'nav.messages' },
  { pattern: '/friends', screen: 'coming-soon', labelKey: 'nav.friends' },
  { pattern: '/following', screen: 'coming-soon', labelKey: 'nav.following' },
  { pattern: '/followers', screen: 'coming-soon', labelKey: 'nav.followers' },
  { pattern: '/leaderboard', screen: 'ranks', tab: 'ranks' },
  { pattern: '/rankings', screen: 'ranks', tab: 'ranks' },
  { pattern: '/achievements', screen: 'coming-soon', labelKey: 'nav.achievements' },
  { pattern: '/missions', screen: 'missions', tab: 'missions' },
  { pattern: '/events', screen: 'coming-soon', labelKey: 'nav.events' },
  { pattern: '/daily', screen: 'coming-soon', labelKey: 'nav.daily' },
  { pattern: '/weekly', screen: 'coming-soon', labelKey: 'nav.weekly' },
  { pattern: '/season', screen: 'coming-soon', labelKey: 'nav.season' },
  { pattern: '/shop', screen: 'coming-soon', labelKey: 'nav.shop' },
  { pattern: '/inventory', screen: 'coming-soon', labelKey: 'nav.inventory' },
  { pattern: '/collections', screen: 'coming-soon', labelKey: 'nav.collections' },
  { pattern: '/badges', screen: 'coming-soon', labelKey: 'nav.badges' },
  { pattern: '/levels', screen: 'coming-soon', labelKey: 'nav.levels' },
  { pattern: '/profile', screen: 'profile', tab: 'profile' },
  { pattern: '/settings', screen: 'settings' },
  { pattern: '/help', screen: 'coming-soon', labelKey: 'nav.help' },
  { pattern: '/about', screen: 'coming-soon', labelKey: 'nav.about' },
  { pattern: '/privacy', screen: 'coming-soon', labelKey: 'nav.privacy' },
  { pattern: '/terms', screen: 'coming-soon', labelKey: 'nav.terms' },
  { pattern: '/contact', screen: 'coming-soon', labelKey: 'nav.contact' },

  { pattern: '/u/:handle', screen: 'profile', tab: 'profile' },
  { pattern: '/u/:handle/posts', screen: 'profile', tab: 'profile' },
  { pattern: '/u/:handle/badges', screen: 'profile', tab: 'profile' },
  { pattern: '/u/:handle/followers', screen: 'coming-soon', labelKey: 'nav.followers' },
  { pattern: '/u/:handle/following', screen: 'coming-soon', labelKey: 'nav.following' },
  { pattern: '/u/:handle/collections', screen: 'coming-soon', labelKey: 'nav.collections' },
  { pattern: '/u/:handle/stats', screen: 'coming-soon', labelKey: 'nav.stats' },

  { pattern: '/post/:postId', screen: 'coming-soon', labelKey: 'nav.post' },
  { pattern: '/comment/:commentId', screen: 'coming-soon', labelKey: 'nav.comment' },
  { pattern: '/poll/:pollId', screen: 'coming-soon', labelKey: 'nav.poll' },
  { pattern: '/event/:eventId', screen: 'coming-soon', labelKey: 'nav.events' },
  { pattern: '/mission/:missionId', screen: 'coming-soon', labelKey: 'nav.missions' },
  { pattern: '/badge/:badgeId', screen: 'coming-soon', labelKey: 'nav.badges' },
  { pattern: '/collection/:collectionId', screen: 'coming-soon', labelKey: 'nav.collections' },

  { pattern: '/admin', screen: 'admin' },
  { pattern: '/admin/*', screen: 'admin' },

  { pattern: '/auth/login', screen: 'auth' },
  { pattern: '/auth/register', screen: 'auth' },
  { pattern: '/auth/forgot-password', screen: 'coming-soon', labelKey: 'nav.auth' },
  { pattern: '/auth/reset-password', screen: 'coming-soon', labelKey: 'nav.auth' },
  { pattern: '/auth/verify', screen: 'coming-soon', labelKey: 'nav.auth' },

  { pattern: '/offline', screen: 'offline' },
  { pattern: '/404', screen: 'not-found' },
  { pattern: '/500', screen: 'server-error' },
];

export const NOT_FOUND_ROUTE: RouteDef = { pattern: '*', screen: 'not-found' };
