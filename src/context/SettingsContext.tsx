import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Locale } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

interface SettingsState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

const STORAGE_KEY = 'sa_settings';

interface StoredSettings {
  locale: Locale;
}

function loadStored(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredSettings>;
      if (parsed.locale === 'tr' || parsed.locale === 'en') {
        return { locale: parsed.locale };
      }
    }
  } catch {
    // ignore
  }
  return { locale: 'tr' };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => loadStored().locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    const stored = loadStored();
    void stored;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ locale: l } as StoredSettings));
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  return (
    <SettingsContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
