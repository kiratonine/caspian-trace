import type { Measurement } from '@/types';

// Ключи — значения enum'ов API (ТЗ §8), поэтому написание как в API, а не camelCase.
export const UNIT_LABELS = {
  'mg/dm3': 'мг/дм³',
  'mg/kg': 'мг/кг',
  percent: '%',
} as const satisfies Record<Measurement['unit'], string>;

export const MATRIX_LABELS = {
  water: 'вода',
  sediment: 'донные отложения',
} as const satisfies Record<Measurement['matrix'], string>;
