import type { TFunction } from "i18next"

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

// Подписи шагов и управление реплеем — в i18n-ресурсе (replay.*), не здесь;
// эти функции — не React-компоненты, поэтому берут `t` параметром, а не хуком.

export function replayStepAriaLabel(stepLabel: string, t: TFunction): string {
  return t("replay.stepAriaLabel", { step: stepLabel })
}

// Число — количество элементов массива payload, не выдуманное значение.
export function replayMeasurementSummary(count: number, t: TFunction): string {
  return count === 1
    ? t("replay.measurementSummaryOne")
    : t("replay.measurementSummaryOther", { count })
}
