import type { EvidenceLevel } from "@/types"

// Тон, а не css-класс: конкретные цвета задаст EvidenceLevelBadge,
// чтобы палитра ТЗ §6 (серый/синий/янтарный/зелёный) жила в одном компоненте.
export type EvidenceTone = "gray" | "blue" | "amber" | "green"

export type EvidenceLevelMeta = {
  code: EvidenceLevel
  tone: EvidenceTone
}

// label и description — в i18n-ресурсе (evidence.<code>.label/.description,
// дословно по ТЗ §6): здесь остаётся только код и тон палитры — это не текст,
// а часть визуального контракта (см. комментарий EvidenceLevelBadge).
export const EVIDENCE_LEVEL_META = {
  L0: { code: "L0", tone: "gray" },
  L1: { code: "L1", tone: "blue" },
  L2: { code: "L2", tone: "amber" },
  L3: { code: "L3", tone: "green" },
} as const satisfies Record<EvidenceLevel, EvidenceLevelMeta>
