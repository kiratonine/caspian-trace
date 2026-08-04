import type { Region } from '@/api/contracts';

// Ключи — значения region из API (ТЗ §12: region=atyrau|mangystau), поэтому
// snake_case. Подписи — области, как в заголовках бюллетеней Казгидромета.
export const REGION_LABELS = {
  atyrau: 'Атырауская область',
  mangystau: 'Мангистауская область',
} as const satisfies Record<Region, string>;
