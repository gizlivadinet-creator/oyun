import { useEffect, useState, useCallback } from 'react';
import {
  Shield, Users, FileText, Target, Award, TrendingUp, Trash2, Plus, X, Save,
} from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { toast } from '@/components/Toast';
import { cn, formatNumber } from '@/lib/utils';
import type { Profile, Mission, Badge, MissionCategory, BadgeTier } from '@/lib/types';

type AdminTab = 'dashboard' | 'users' | 'missions' | 'badges';

export function AdminPage() {
  const { t, locale } = useSettings();
  const [tab, setTab] = useState<AdminTab>('dashboard');

  const tabs: Array<{ id: AdminTab; icon: typeof Shield; label: string }> = [
    { id: 'dashboard', icon: TrendingUp, label: t('admin.dashboard') },
    { id: 'users', icon: Users, label: t('admin.users') },
    { id: 'missions', icon: Target, label: t('admin.missions') },
    { id: 'badges', icon: Award, label: t('admin.badges') },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Shield className="h-5 w-5 text-emerald-400" /> {t('admin.title')}
      </h1>

      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl overflow-x-auto no-scrollbar">
        {tabs.map((tabItem) => {
          const Icon = tabItem.icon;
          return (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
                tab === tabItem.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {tabItem.label}
            </button>
          );
        })}
      </div>

      {tab === 'dashboard' && <Dashboard t={t} />}
      {tab === 'users' && <UsersPanel t={t} />}
      {tab === 'missions' && <MissionsPanel t={t} />}
      {tab === 'badges' && <BadgesPanel t={t} locale={locale} />}
    </div>
  );
}

interface PanelProps {
  t: (k: string) => string;
}

interface PanelPropsWithLocale extends PanelProps {
  locale: 'tr' | 'en';
}

function Dashboard({ t }: PanelProps) {
  const [stats, setStats] = useState({
    users: 0, posts: 0, likes: 0, comments: 0, activeToday: 0, newUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const dayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00';
        const [u, p, l, c, active, newU] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('posts').select('id', { count: 'exact', head: true }),
          supabase.from('likes').select('id', { count: 'exact', head: true }),
          supabase.from('comments').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('updated_at', dayStart),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', dayStart),
        ]);
        setStats({
          users: u.count ?? 0,
          posts: p.count ?? 0,
          likes: l.count ?? 0,
          comments: c.count ?? 0,
          activeToday: active.count ?? 0,
          newUsers: newU.count ?? 0,
        });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-10"><Spinner size="lg" /></div>;

  const cards = [
    { label: t('admin.totalUsers'), value: stats.users, icon: Users, color: 'text-emerald-400' },
    { label: t('admin.totalPosts'), value: stats.posts, icon: FileText, color: 'text-sky-400' },
    { label: t('admin.totalLikes'), value: stats.likes, icon: TrendingUp, color: 'text-rose-400' },
    { label: t('admin.totalComments'), value: stats.comments, icon: FileText, color: 'text-violet-400' },
    { label: t('admin.activeToday'), value: stats.activeToday, icon: Users, color: 'text-amber-400' },
    { label: t('admin.newUsers'), value: stats.newUsers, icon: Users, color: 'text-teal-400' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="card p-4">
            <Icon className={cn('h-5 w-5 mb-2', c.color)} />
            <p className="text-2xl font-bold tabular-nums">{formatNumber(c.value)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{c.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function UsersPanel({ t }: PanelProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setUsers((data ?? []) as Profile[]);
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRole = async (u: Profile) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: newRole } : x)));
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', u.id);
      if (error) throw error;
      toast(`${u.display_name}: ${newRole}`, 'success');
    } catch {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role: u.role } : x)));
      toast(t('common.error'), 'error');
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="card p-3 flex items-center gap-3">
          <Avatar id={u.id} name={u.display_name} url={u.avatar_url} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{u.display_name}</p>
            <p className="text-[10px] text-slate-500">Lv.{u.level} · {u.xp} XP</p>
          </div>
          <span className={cn(
            'chip text-[9px]',
            u.role === 'admin' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/50 text-slate-400',
          )}>
            {u.role}
          </span>
          <button
            onClick={() => toggleRole(u)}
            className="btn-ghost text-[10px] py-1 px-2"
          >
            {u.role === 'admin' ? t('admin.makeUser') : t('admin.makeAdmin')}
          </button>
        </div>
      ))}
      {users.length === 0 && (
        <div className="card p-8 text-center text-sm text-slate-500">No users.</div>
      )}
    </div>
  );
}

function MissionsPanel({ t }: PanelProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '', title_tr: '', title_en: '', description_tr: '', description_en: '',
    target: 1, xp_reward: 10, coin_reward: 5, category: 'daily' as MissionCategory,
  });

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('missions').select('*').order('created_at');
      if (error) throw error;
      setMissions((data ?? []) as Mission[]);
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.code || !form.title_tr) {
      toast(t('common.error'), 'error');
      return;
    }
    try {
      const { error } = await supabase.from('missions').insert({
        ...form,
        target: Number(form.target),
        xp_reward: Number(form.xp_reward),
        coin_reward: Number(form.coin_reward),
        is_active: true,
      });
      if (error) throw error;
      setShowForm(false);
      setForm({ code: '', title_tr: '', title_en: '', description_tr: '', description_en: '', target: 1, xp_reward: 10, coin_reward: 5, category: 'daily' });
      toast(t('admin.save'), 'success');
      await load();
    } catch {
      toast(t('common.error'), 'error');
    }
  };

  const remove = async (m: Mission) => {
    try {
      const { error } = await supabase.from('missions').delete().eq('id', m.id);
      if (error) throw error;
      setMissions((prev) => prev.filter((x) => x.id !== m.id));
      toast(t('admin.delete'), 'success');
    } catch {
      toast(t('common.error'), 'error');
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)} className="btn-primary w-full">
        <Plus className="h-4 w-4" /> {t('admin.addMission')}
      </button>

      {missions.map((m) => (
        <div key={m.id} className="card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{m.title_tr}</p>
              <p className="text-[10px] text-slate-500 font-mono">{m.code}</p>
              <p className="text-xs text-slate-400 mt-1">{m.description_tr}</p>
              <div className="flex gap-2 mt-2 text-[10px]">
                <span className="chip bg-emerald-500/15 text-emerald-400">+{m.xp_reward} XP</span>
                <span className="chip bg-amber-500/15 text-amber-400">+{m.coin_reward} Coin</span>
                <span className="chip bg-slate-700/50 text-slate-300">{m.category}</span>
              </div>
            </div>
            <button onClick={() => remove(m)} className="btn-ghost p-1.5 text-slate-500 hover:text-rose-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t('admin.addMission')}>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar">
          <FormInput label={t('admin.code')} value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
          <FormInput label={t('admin.titleTr')} value={form.title_tr} onChange={(v) => setForm({ ...form, title_tr: v })} />
          <FormInput label={t('admin.titleEn')} value={form.title_en} onChange={(v) => setForm({ ...form, title_en: v })} />
          <FormInput label={t('admin.descTr')} value={form.description_tr} onChange={(v) => setForm({ ...form, description_tr: v })} />
          <FormInput label={t('admin.descEn')} value={form.description_en} onChange={(v) => setForm({ ...form, description_en: v })} />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label={t('admin.target')} value={String(form.target)} onChange={(v) => setForm({ ...form, target: Number(v) || 1 })} type="number" />
            <div>
              <label className="label">{t('admin.category')}</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as MissionCategory })}
              >
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
                <option value="seasonal">seasonal</option>
                <option value="special">special</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormInput label={t('admin.xpReward')} value={String(form.xp_reward)} onChange={(v) => setForm({ ...form, xp_reward: Number(v) || 0 })} type="number" />
            <FormInput label={t('admin.coinReward')} value={String(form.coin_reward)} onChange={(v) => setForm({ ...form, coin_reward: Number(v) || 0 })} type="number" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1"><X className="h-4 w-4" /> {t('admin.cancel')}</button>
            <button onClick={save} className="btn-primary flex-1"><Save className="h-4 w-4" /> {t('admin.save')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function BadgesPanel({ t, locale }: PanelPropsWithLocale) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '', name_tr: '', name_en: '', description_tr: '', description_en: '',
    icon: 'Award', tier: 'bronze' as BadgeTier,
  });

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('badges').select('*').order('created_at');
      if (error) throw error;
      setBadges((data ?? []) as Badge[]);
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.code || !form.name_tr) {
      toast(t('common.error'), 'error');
      return;
    }
    try {
      const { error } = await supabase.from('badges').insert({ ...form });
      if (error) throw error;
      setShowForm(false);
      setForm({ code: '', name_tr: '', name_en: '', description_tr: '', description_en: '', icon: 'Award', tier: 'bronze' });
      toast(t('admin.save'), 'success');
      await load();
    } catch {
      toast(t('common.error'), 'error');
    }
  };

  const remove = async (b: Badge) => {
    try {
      const { error } = await supabase.from('badges').delete().eq('id', b.id);
      if (error) throw error;
      setBadges((prev) => prev.filter((x) => x.id !== b.id));
      toast(t('admin.delete'), 'success');
    } catch {
      toast(t('common.error'), 'error');
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(true)} className="btn-primary w-full">
        <Plus className="h-4 w-4" /> {t('admin.addBadge')}
      </button>

      {badges.map((b) => (
        <div key={b.id} className="card p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{locale === 'tr' ? b.name_tr : b.name_en}</p>
            <p className="text-[10px] text-slate-500 font-mono">{b.code} · {b.tier} · {b.icon}</p>
            <p className="text-xs text-slate-400 mt-1">{locale === 'tr' ? b.description_tr : b.description_en}</p>
          </div>
          <button onClick={() => remove(b)} className="btn-ghost p-1.5 text-slate-500 hover:text-rose-400">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t('admin.addBadge')}>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar">
          <FormInput label={t('admin.code')} value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
          <FormInput label={t('admin.nameTr')} value={form.name_tr} onChange={(v) => setForm({ ...form, name_tr: v })} />
          <FormInput label={t('admin.nameEn')} value={form.name_en} onChange={(v) => setForm({ ...form, name_en: v })} />
          <FormInput label={t('admin.descTr')} value={form.description_tr} onChange={(v) => setForm({ ...form, description_tr: v })} />
          <FormInput label={t('admin.descEn')} value={form.description_en} onChange={(v) => setForm({ ...form, description_en: v })} />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label={t('admin.icon')} value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />
            <div>
              <label className="label">{t('admin.tier')}</label>
              <select className="input" value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as BadgeTier })}>
                {(['bronze', 'silver', 'gold', 'platinum', 'diamond'] as BadgeTier[]).map((tier) => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1"><X className="h-4 w-4" /> {t('admin.cancel')}</button>
            <button onClick={save} className="btn-primary flex-1"><Save className="h-4 w-4" /> {t('admin.save')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FormInput({
  label, value, onChange, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
