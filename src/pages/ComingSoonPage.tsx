import { Sparkles } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';

interface ComingSoonPageProps {
  label?: string;
}

/**
 * Sitemap'te yer alan ancak henüz UI'ı geliştirilmemiş rotalar için
 * genel bir "yakında" ekranı. URL yapısını (ölçeklenebilirlik için)
 * canlı tutar, gerçek sayfa hazır olduğunda burada değiştirilmesi yeterlidir.
 */
export function ComingSoonPage({ label }: ComingSoonPageProps) {
  const { t } = useSettings();
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-3 text-slate-400">
      <div className="h-12 w-12 rounded-2xl gradient-emerald flex items-center justify-center">
        <Sparkles className="h-6 w-6 text-slate-950" />
      </div>
      <p className="font-semibold text-slate-200">{label ?? t('common.comingSoon')}</p>
      <p className="text-sm max-w-xs">{t('common.comingSoonDesc')}</p>
    </div>
  );
}
