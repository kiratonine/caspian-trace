import type { EvidenceLevel } from "@/types"

// Тон, а не css-класс: конкретные цвета задаст EvidenceLevelBadge,
// чтобы палитра ТЗ §6 (серый/синий/янтарный/зелёный) жила в одном компоненте.
export type EvidenceTone = "gray" | "blue" | "amber" | "green"

export type EvidenceLevelMeta = {
  code: EvidenceLevel
  label: string
  description: string
  tone: EvidenceTone
}

// Подписи и расшифровки — дословно по ТЗ §6.
export const EVIDENCE_LEVEL_META = {
  L0: {
    code: "L0",
    label: "Непроверенный сигнал",
    description:
      "Есть одна публикация или публичное сообщение. Лабораторного подтверждения нет.",
    tone: "gray",
  },
  L1: {
    code: "L1",
    label: "Событие подтверждено",
    description:
      "Событие описано двумя независимыми источниками, существует официальный источник или опубликованы результаты отбора проб.",
    tone: "blue",
  },
  L2: {
    code: "L2",
    label: "Источник локализован до участка",
    description:
      "Определён физически допустимый участок; минимум одна географическая версия исключена фактом, а не отсутствием данных.",
    tone: "amber",
  },
  L3: {
    code: "L3",
    label: "Коридор поддержан лабораторными данными",
    description:
      "На одной дате и в сопоставимых единицах есть парные измерения между соседними створами. Не означает, что виновник установлен.",
    tone: "green",
  },
} as const satisfies Record<EvidenceLevel, EvidenceLevelMeta>
