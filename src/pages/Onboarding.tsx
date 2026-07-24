import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { toast } from '@/components/Toast';
import { Spinner } from '@/components/Spinner';
import { Sparkles, ChevronRight, Check } from 'lucide-react';

export function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const { t } = useSettings();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);

  const steps = [
    { title: t('onboard.displayName'), field: 'display_name' },
    { title: t('onboard.username'), field: 'username' },
    { title: t('onboard.bio'), field: 'bio' },
    { title: t('onboard.country'), field: 'country' },
  ];

  const canProceed = () => {
    if (step === 0) return displayName.trim().length >= 2;
    if (step === 1) return /^[a-zA-Z0-9_]{3,20}$/.test(username.trim());
    if (step === 2) return true;
    if (step === 3) return true;
    return false;
  };

  const handleNext = async () => {
    if (step === 1) {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .neq('id', user?.id ?? '')
        .maybeSingle();
      if (data) {
        toast(t('onboard.usernameTaken'), 'error');
        return;
      }
    }
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      await finish();
    }
  };

  const finish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        country: country.trim(),
      });
      if (error) throw error;
      await refreshProfile();
      toast(t('auth.welcome'), 'success');
    } catch {
      toast(t('auth.errorGeneric'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl animate-float" />
      </div>

      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl gradient-emerald flex items-center justify-center shadow-xl shadow-emerald-500/30 mb-3">
            <Sparkles className="h-7 w-7 text-slate-950" />
          </div>
          <h1 className="text-xl font-bold">{t('onboard.welcome')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('onboard.setup')}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-8 bg-emerald-500' : i < step ? 'w-4 bg-emerald-700' : 'w-4 bg-slate-800'
              }`}
            />
          ))}
        </div>

        <div className="card p-6">
          <p className="text-xs text-slate-400 mb-1">
            {t('onboard.step')} {step + 1} {t('onboard.of')} {steps.length}
          </p>
          <h2 className="text-lg font-bold mb-4">{steps[step].title}</h2>

          {step === 0 && (
            <input
              className="input"
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="..."
              maxLength={30}
            />
          )}
          {step === 1 && (
            <>
              <input
                className="input"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="username"
                maxLength={20}
              />
              <p className="text-[10px] text-slate-500 mt-2">{t('onboard.usernameInvalid')}</p>
            </>
          )}
          {step === 2 && (
            <textarea
              className="input min-h-[80px] resize-none"
              autoFocus
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('profile.bioPlaceholder')}
              maxLength={160}
            />
          )}
          {step === 3 && (
            <input
              className="input"
              autoFocus
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder={t('onboard.countryPlaceholder')}
              maxLength={40}
            />
          )}

          <button
            onClick={handleNext}
            disabled={!canProceed() || loading}
            className="btn-primary w-full mt-5"
          >
            {loading ? (
              <Spinner size="sm" />
            ) : step === steps.length - 1 ? (
              <>
                <Check className="h-4 w-4" /> {t('onboard.finish')}
              </>
            ) : (
              <>
                {t('onboard.continue')} <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
