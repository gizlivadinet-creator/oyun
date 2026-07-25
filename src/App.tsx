import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ToastContainer } from '@/components/Toast';
import { FullScreenSpinner } from '@/components/Spinner';
import { Onboarding } from '@/pages/Onboarding';
import { AppShell } from '@/components/AppShell';
import { useSettings } from '@/context/SettingsContext';
import { RouterProvider } from '@/lib/router';

function Gate() {
  const { session, profile, loading, needsOnboarding } = useAuth();
  const { t } = useSettings();

  if (loading) {
    return <FullScreenSpinner label={t('auth.loading')} />;
  }

  // Signed-in but hasn't finished onboarding yet -> must finish before
  // anything else. A guest (no session at all) skips straight to AppShell,
  // which renders the public feed/profiles and only asks for a login when
  // an interactive action needs one (see AuthContext.requireAuth).
  if (session && (needsOnboarding || !profile)) {
    return <Onboarding />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <SettingsProvider>
      <RouterProvider>
        <AuthProvider>
          <Gate />
          <ToastContainer />
        </AuthProvider>
      </RouterProvider>
    </SettingsProvider>
  );
}
