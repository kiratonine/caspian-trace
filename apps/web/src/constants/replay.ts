import type { ReplayStepType } from "@/types"

// ТЗ §12: рекомендуемые интервалы шагов демо-реплея.
export const REPLAY_STEP_OFFSETS_MS = [0, 5000, 12000, 22000, 32000] as const

// Хронология демо-сценария ТЗ §14: сигнал → подтверждение → измерения →
// правило → вывод. Индекс здесь соответствует индексу в REPLAY_STEP_OFFSETS_MS.
export const REPLAY_STEP_TYPE_ORDER = [
  "signal",
  "corroboration",
  "measurement",
  "inference",
  "conclusion",
] as const satisfies readonly ReplayStepType[]

export const REPLAY_STEP_TYPE_LABELS = {
  signal: "Публичный сигнал",
  corroboration: "Подтверждение события",
  measurement: "Лабораторные значения",
  inference: "Применение правила",
  conclusion: "Вывод",
} as const satisfies Record<ReplayStepType, string>

// Управление реплеем (сессия 9). Формулировки осторожные: недоступный
// сценарий и «ещё не показанный» блок — состояния данных, а не ошибки.
export const REPLAY_PLAY_LABEL = "Запустить реплей"
export const REPLAY_RESUME_LABEL = "Продолжить реплей"
export const REPLAY_RESTART_LABEL = "Запустить реплей заново"
export const REPLAY_PAUSE_LABEL = "Пауза"
export const REPLAY_EXIT_LABEL = "Завершить реплей"

export const REPLAY_KEYBOARD_HINT =
  "Реплей: пробел — пуск и пауза, ←/→ — по шагам"

export const REPLAY_UNAVAILABLE =
  "Сценарий реплея для этого события пока недоступен."

// Пустое состояние блоков панели во время реплея: содержимое не скрыто
// навсегда, а ещё не наступило в хронологии доказательств.
export const REPLAY_PENDING = "Появится на одном из следующих шагов реплея."

export function replayStepAriaLabel(stepLabel: string): string {
  return `Перейти к шагу «${stepLabel}»`
}

// Число — количество элементов массива payload, не выдуманное значение.
export function replayMeasurementSummary(count: number): string {
  return count === 1
    ? "Загружено лабораторное значение по 1 створу"
    : `Загружены лабораторные значения по ${count} створам`
}
