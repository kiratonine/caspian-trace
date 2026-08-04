import type { ReplayStepType } from '@/types';

// ТЗ §12: рекомендуемые интервалы шагов демо-реплея.
export const REPLAY_STEP_OFFSETS_MS = [0, 5000, 12000, 22000, 32000] as const;

export const REPLAY_STEP_TYPE_LABELS = {
  signal: 'Публичный сигнал',
  corroboration: 'Подтверждение события',
  measurement: 'Лабораторные значения',
  inference: 'Применение правила',
  conclusion: 'Вывод',
} as const satisfies Record<ReplayStepType, string>;
