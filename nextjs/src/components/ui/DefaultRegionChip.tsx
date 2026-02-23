'use client';

import { CONSORTIUM_ICONS } from '@/lib/constants';
import { useLang } from '@/contexts/LangContext';
import { PLANNER_STRINGS } from '@/lib/i18n';

interface DefaultRegionChipProps {
  consorcio: { idConsorcio: string; nombre: string };
  onChangeRegion: () => void;
}

export default function DefaultRegionChip({ consorcio, onChangeRegion }: DefaultRegionChipProps) {
  const { lang } = useLang();
  const s = PLANNER_STRINGS[lang];
  const icon = CONSORTIUM_ICONS[consorcio.idConsorcio] || '🚌';

  return (
    <div className="default-region-chip">
      <span className="default-region-chip-icon">{icon}</span>
      <span className="default-region-chip-name">{consorcio.nombre}</span>
      <button className="default-region-chip-change" onClick={onChangeRegion}>
        {s.changeRegion}
      </button>
    </div>
  );
}
