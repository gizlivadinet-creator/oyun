import { WifiOff } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';

export function OfflinePage() {
  const { t } = useSettings();
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-3">
      <div className="h-14 w-14 rounded-2xl bg-slate-800 flex items-center justify-center">
        <WifiOff className="h-7 w-7 text-slate-400" />
      </div>
      <p className="font-semibold">{t('offline.title')}</p>
      <p className="text-sm text-slate-400 max-w-xs">{t('offline.desc')}</p>
    </div>
  );
}
