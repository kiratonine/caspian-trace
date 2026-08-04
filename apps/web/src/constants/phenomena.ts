import type { IncidentSignal, Phenomenon } from "@/types"

// Ключи — значения enum'ов API (ТЗ §8), поэтому snake_case, а не camelCase.
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
} as const satisfies Record<
  IncidentSignal["verificationStatus"],
  { label: string }
>
