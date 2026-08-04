// Типы предметной области больше не пишутся во фронте: с 04.08.2026 их источник —
// общий пакет `@caspian-trace/contracts` (владелец — Full-stack 1), где рядом
// с каждым типом лежит Zod-схема, которой ответ проверяется на границе сети.
// Собственные копии типов ТЗ §8 удалены: две правды о форме данных разъезжаются
// на первой же правке контракта.
//
// Баррель оставлен, чтобы компоненты продолжали импортировать из «@/types»,
// а смена источника типов оставалась правкой одного файла.
export type {
  CandidateObject,
  CorridorBounds,
  EvidenceLevel,
  EvidenceStatement,
  ExtractionMode,
  IncidentSignal,
  Investigation,
  InvestigationUnknown,
  Measurement,
  Phenomenon,
  Region,
  ReplayStep,
  SourceDocument,
  Station,
  VerificationStatus,
} from "@caspian-trace/contracts"

import type { ReplayStep } from "@caspian-trace/contracts"

// В пакете шаг реплея — дискриминированный юнион, отдельного типа-дискриминатора
// в нём нет; справочникам `constants/replay.ts` нужен именно перечень типов шагов.
export type ReplayStepType = ReplayStep["type"]
