import { AlertTriangle } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { Link } from '@/lib/router';

export function ServerErrorPage() {
  const { t } = useSettings();
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-3">
      <div className="h-14 w-14 rounded-2xl bg-rose-500/10 flex items-center justify-center">
        <AlertTriangle className="h-7 w-7 text-rose-400" />
      </div>
      <p className="text-4xl font-bold text-slate-200">500</p>
      <p className="font-semibold">{t('error.500Title')}</p>
      <p className="text-sm text-slate-400 max-w-xs">{t('error.500Desc')}</p>
      <Link to="/" className="btn-primary mt-2 px-4 py-2 rounded-lg text-sm inline-block">
        {t('common.goHome')}
      </Link>
    </div>
  );
}
