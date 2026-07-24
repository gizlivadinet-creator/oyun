import { useEffect, useState, useCallback } from 'react';
import { Search, TrendingUp, Flame, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/Spinner';
import { cn } from '@/lib/utils';
import { searchProfiles, fetchLeaderboard } from '@/lib/services';
import type { Profile } from '@/lib/types';

interface ExplorePageProps {
  onOpenProfile: (id: string) => void;
}

export function ExplorePage({ onOpenProfile }: ExplorePageProps) {
  const { profile } = useAuth();
  const { t } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [trending, setTrending] = useState<Profile[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);

  useEffect(() => {
    if (!profile) return;
    fetchLeaderboard('global', profile.id, 10)
      .then(setTrending)
      .catch(() => {})
      .finally(() => setLoadingTrending(false));
  }, [profile]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const r = await searchProfiles(q.trim());
      setResults(r);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(id);
  }, [query, runSearch]);

  const showResults = query.trim().length >= 2;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Search className="h-5 w-5 text-emerald-400" /> {t('nav.explore')}
        </h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          className="input pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common.search')}
        />
        {searching && (
          <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />
        )}
      </div>

      {showResults ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 px-1">{results.length} sonuç</p>
          {results.length === 0 && !searching && (
            <div className="card p-8 text-center text-sm text-slate-500">{t('rank.empty')}</div>
          )}
          {results.map((p) => (
            <UserRow key={p.id} profile={p} isMe={p.id === profile?.id} onOpen={() => onOpenProfile(p.id)} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-bold">Trending</h2>
            </div>
            {loadingTrending ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <div className="space-y-2">
                {trending.slice(0, 5).map((p, i) => (
                  <UserRow
                    key={p.id}
                    profile={p}
                    rank={i + 1}
                    isMe={p.id === profile?.id}
                    onOpen={() => onOpenProfile(p.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-orange-400" />
              <h2 className="text-sm font-bold">Hot</h2>
            </div>
            {loadingTrending ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <div className="space-y-2">
                {trending.slice(5, 10).map((p, i) => (
                  <UserRow
                    key={p.id}
                    profile={p}
                    rank={i + 6}
                    isMe={p.id === profile?.id}
                    onOpen={() => onOpenProfile(p.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function UserRow({
  profile: p, rank, isMe, onOpen,
}: {
  profile: Profile;
  rank?: number;
  isMe: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        'card p-3 flex items-center gap-3 w-full text-left transition-all hover:bg-white/5',
        isMe && 'ring-1 ring-emerald-500/30',
      )}
    >
      {rank && <span className="w-5 text-center text-xs font-bold text-slate-500 tabular-nums">{rank}</span>}
      <Avatar id={p.id} name={p.display_name} url={p.avatar_url} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{p.display_name}</p>
        {p.username && <p className="text-[10px] text-slate-500 truncate">@{p.username}</p>}
      </div>
      <span className="chip bg-emerald-500/15 text-emerald-400 text-[9px]">Lv.{p.level}</span>
    </button>
  );
}
