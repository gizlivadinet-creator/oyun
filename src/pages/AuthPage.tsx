import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/context/SettingsContext';
import { toast } from '@/components/Toast';
import { Spinner } from '@/components/Spinner';
import { Sparkles, Mail, Lock, User, AtSign } from 'lucide-react';

export function AuthPage() {
  const { t } = useSettings();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (password.length < 6) {
        setError(t('auth.errorWeak'));
        return;
      }
      if (password !== confirm) {
        setError(t('auth.errorMismatch'));
        return;
      }
      if (!displayName.trim()) {
        setError(t('auth.errorGeneric'));
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast(t('auth.welcomeBack'), 'success');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim(), username: username.trim() } },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            display_name: displayName.trim(),
            username: username.trim() || null,
          });
        }
        toast(t('auth.welcome'), 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Invalid login')) setError(t('auth.errorInvalid'));
      else if (msg.includes('already registered') || msg.includes('already been registered'))
        setError(t('auth.errorExists'));
      else if (msg.includes('password')) setError(t('auth.errorWeak'));
      else setError(t('auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/3 left-10 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl gradient-emerald flex items-center justify-center shadow-xl shadow-emerald-500/30 mb-3">
            <Sparkles className="h-8 w-8 text-slate-950" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t('app.name')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('app.tagline')}</p>
        </div>

        <div className="card p-6">
          <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl mb-5">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  mode === m ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m === 'signin' ? t('auth.signIn') : t('auth.signUp')}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="auth-display-name" className="label">{t('auth.displayName')}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      id="auth-display-name"
                      name="displayName"
                      className="input pl-10"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="..."
                      maxLength={30}
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="auth-username" className="label">{t('auth.username')}</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      id="auth-username"
                      name="username"
                      className="input pl-10"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="username"
                      maxLength={20}
                      autoComplete="username"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{t('auth.usernameHint')}</p>
                </div>
              </>
            )}

            <div>
              <label htmlFor="auth-email" className="label">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  className="input pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="label">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  className="input pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-confirm-password" className="label">{t('auth.confirmPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="auth-confirm-password"
                    name="confirmPassword"
                    type="password"
                    className="input pl-10"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 animate-scale-in">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <Spinner size="sm" /> : mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-4">
            {mode === 'signin' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
              className="text-emerald-400 font-semibold hover:underline"
            >
              {mode === 'signin' ? t('auth.signUp') : t('auth.signIn')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
