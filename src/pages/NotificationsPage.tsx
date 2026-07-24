import { useEffect, useState, useCallback } from 'react';
import { Bell, Check, Heart, MessageSquare, UserPlus, Award, TrendingUp, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/Spinner';
import { toast } from '@/components/Toast';
import { cn, timeAgo } from '@/lib/utils';
import { fetchNotifications, markAllNotificationsRead } from '@/lib/services';
import type { NotificationType } from '@/lib/types';

interface NotificationRow {
  id: string;
  type: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
  actor_id: string | null;
  actor?: { id: string; display_name: string; avatar_url: string | null } | null;
}

interface NotificationsPageProps {
  onOpenProfile: (id: string) => void;
}

const TYPE_ICON: Record<string, typeof Heart> = {
  follow: UserPlus,
  like: Heart,
  comment: MessageSquare,
  badge: Award,
  levelup: TrendingUp,
  system: Info,
};

const TYPE_COLOR: Record<string, string> = {
  follow: 'text-sky-400 bg-sky-500/10',
  like: 'text-rose-400 bg-rose-500/10',
  comment: 'text-emerald-400 bg-emerald-500/10',
  badge: 'text-amber-400 bg-amber-500/10',
  levelup: 'text-violet-400 bg-violet-500/10',
  system: 'text-slate-400 bg-slate-500/10',
};

export function NotificationsPage({ onOpenProfile }: NotificationsPageProps) {
  const { profile } = useAuth();
  const { t, locale } = useSettings();
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const data = await fetchNotifications(profile.id);
      setNotifs(data as NotificationRow[]);
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [profile, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkAll = async () => {
    if (!profile) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead(profile.id);
    } catch {
      toast(t('common.error'), 'error');
    }
  };

  const hasUnread = notifs.some((n) => !n.read);

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Bell className="h-5 w-5 text-emerald-400" /> {t('notif.title')}
        </h1>
        {hasUnread && (
          <button onClick={handleMarkAll} className="btn-ghost text-xs py-1.5 px-2">
            <Check className="h-3.5 w-3.5" /> {t('notif.markAll')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : notifs.length === 0 ? (
        <div className="card p-10 text-center">
          <Bell className="h-10 w-10 text-slate-700 mx-auto mb-2" />
          <p className="text-sm text-slate-500">{t('notif.empty')}</p>
        </div>
      ) : (
        notifs.map((n) => {
          const Icon = TYPE_ICON[n.type] ?? Info;
          const color = TYPE_COLOR[n.type] ?? TYPE_COLOR.system;
          const actor = n.actor;
          return (
            <button
              key={n.id}
              onClick={() => n.actor_id && onOpenProfile(n.actor_id)}
              className={cn(
                'card p-3 flex items-center gap-3 w-full text-left transition-all hover:bg-white/5',
                !n.read && 'ring-1 ring-emerald-500/30',
              )}
            >
              <div className="relative shrink-0">
                {actor ? (
                  <Avatar id={actor.id} name={actor.display_name} url={actor.avatar_url} size="md" />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-slate-800 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-slate-400" />
                  </div>
                )}
                <span className={cn('absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-slate-950', color)}>
                  <Icon className="h-3 w-3" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200">
                  {actor && <span className="font-semibold">{actor.display_name} </span>}
                  <span className="text-slate-400">{n.body || t(`notif.${n.type}`)}</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{timeAgo(n.created_at, locale)}</p>
              </div>
              {!n.read && <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />}
            </button>
          );
        })
      )}
    </div>
  );
}
