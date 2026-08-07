// Формы ответов API. С 04.08.2026 они больше не провизорны и не живут во фронте:
// источник — общий пакет `@caspian-trace/contracts` (владелец — Full-stack 1),
// где у каждой формы есть Zod-схема. Файл оставлен тонким слоем, чтобы
// компоненты продолжали импортировать из «@/api/contracts», а не тянули пакет
// напрямую: если пакет переименуют или разделят, правка будет здесь одна.
//
// Что закрылось переездом (было провизорным с сессий 2–12):
//   • `IncidentSummary.period` — подтверждён (вопрос 4);
//   • payload шагов реплея — юнион совпал с нашим `TypedReplayStep`,
//     собственный тип удалён (вопрос 3);
//   • `corridorBounds` — подтверждён (вопрос 6);
//   • состав досье — `Dossier` вместо нашего `DossierExport` (вопрос 5);
//   • `rulesetVersion`/`inputHash` — не в `IncidentDetail`, как мы просили,
//     а полями `Dossier` (вопрос 14);
//   • форма ошибки `{code, message, requestId}` — `ApiError` (вопрос 7).
export type {
  ApiError,
  Dossier,
  EvidenceGraph,
  IncidentDetail,
  IncidentSummary,
  LiveStatus,
  Region,
  ReplayScenario,
  ReplayStep,
  SourceHealthItem,
} from "@caspian-trace/contracts"

import type {
  EvidenceLevel,
  Region,
  SourceHealthItem,
} from "@caspian-trace/contracts"

// Перечень статусов источника отдельным типом в пакете не объявлен (как и тип
// шага реплея), а справочнику `constants/live-status.ts` нужен именно он.
export type SourceHealthStatus = SourceHealthItem["status"]

// Параметры GET /api/incidents (роадмап §9.1). В пакете их нет: это форма
// запроса, а не ответа, и проверять на границе сети здесь нечего.
export type IncidentListParams = {
  status?: EvidenceLevel
  region?: Region
  from?: string
  to?: string
  limit?: number // максимум MAX_INCIDENTS_LIMIT
}
