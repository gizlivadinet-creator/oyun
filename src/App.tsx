import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ToastContainer } from '@/components/Toast';
import { FullScreenSpinner } from '@/components/Spinner';
import { AuthPage } from '@/pages/AuthPage';
import { Onboarding } from '@/pages/Onboarding';
import { AppShell } from '@/components/AppShell';
import { useSettings } from '@/context/SettingsContext';

function Gate() {
  const { session, profile, loading, needsOnboarding } = useAuth();
  const { t } = useSettings();

  if (loading) {
    return <FullScreenSpinner label={t('auth.loading')} />;
  }

  if (!session) {
    return <AuthPage />;
  }

  if (needsOnboarding || !profile) {
    return <Onboarding />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <Gate />
        <ToastContainer />
      </AuthProvider>
    </SettingsProvider>
  );
}
