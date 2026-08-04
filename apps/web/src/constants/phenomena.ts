import type { Phenomenon, VerificationStatus } from "@/types"

// Ключи — значения полей API (ТЗ §8), поэтому snake_case, а не camelCase.
export const PHENOMENON_LABELS = {
  oil_film: "нефтяная плёнка",
  color_change: "изменение цвета воды",
  odor: "запах",
  fish_kill: "гибель рыбы",
  wastewater: "сточные воды",
  other: "другое явление",
} as const satisfies Record<Phenomenon, string>

export const VERIFICATION_STATUS_META = {
  unverified: { label: "Не подтверждено" },
  corroborated: { label: "Подтверждено независимыми источниками" },
  official: { label: "Официальный источник" },
  // Роадмап §7: сообщения об одном сигнале могут расходиться. Формулировка
  // описывает состояние источников, а не достоверность самого явления.
  conflicting: { label: "Источники расходятся" },
} as const satisfies Record<VerificationStatus, { label: string }>

// `phenomenon` в схеме бэка — свободная строка, поэтому известное значение
// переводим, а незнакомое показываем как есть: `undefined` на экране хуже
// сырого кода явления.
const phenomenonLabels: Record<string, string> = PHENOMENON_LABELS

export function phenomenonLabel(phenomenon: string): string {
  return phenomenonLabels[phenomenon] ?? phenomenon
}
