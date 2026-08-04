import type { ReplayStepType } from '@/types';

// ТЗ §12: рекомендуемые интервалы шагов демо-реплея.
export const REPLAY_STEP_OFFSETS_MS = [0, 5000, 12000, 22000, 32000] as const;

// Хронология демо-сценария ТЗ §14: сигнал → подтверждение → измерения →
// правило → вывод. Индекс здесь соответствует индексу в REPLAY_STEP_OFFSETS_MS.
export const REPLAY_STEP_TYPE_ORDER = [
  'signal',
  'corroboration',
  'measurement',
  'inference',
  'conclusion',
] as const satisfies readonly ReplayStepType[];

export const REPLAY_STEP_TYPE_LABELS = {
  signal: 'Публичный сигнал',
  corroboration: 'Подтверждение события',
  measurement: 'Лабораторные значения',
  inference: 'Применение правила',
  conclusion: 'Вывод',
} as const satisfies Record<ReplayStepType, string>;
