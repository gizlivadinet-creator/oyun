import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from '@/lib/router';
import type { Profile } from '@/lib/types';

async function updateStreak(userId: string, lastLogin: string | null, currentStreak: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (lastLogin === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newStreak = lastLogin === yesterday ? currentStreak + 1 : 1;

  const { error } = await supabase
    .from('profiles')
    .update({ streak: newStreak, last_login_date: today })
    .eq('id', userId);
  if (error) console.error('Streak update error:', error.message);
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  needsOnboarding: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Guard for actions that require a signed-in user (like, comment, repost,
   * bookmark, follow, posting, editing a profile...). Returns true when the
   * caller already has a session; otherwise it sends the guest to the login
   * screen and returns false so the caller can bail out of the handler.
   */
  requireAuth: () => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      console.error('Profile load error:', error.message);
      return;
    }
    setProfile(data as Profile | null);
    setNeedsOnboarding(!data);

    if (data) {
      (async () => {
        await updateStreak(uid, data.last_login_date, data.streak);
      })();
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await loadProfile(newSession.user.id);
        } else {
          setProfile(null);
          setNeedsOnboarding(false);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setNeedsOnboarding(false);
  }, []);

  const { navigate } = useRouter();
  const requireAuth = useCallback(() => {
    if (user) return true;
    navigate('/auth/login');
    return false;
  }, [user, navigate]);

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, needsOnboarding, refreshProfile, signOut, requireAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
