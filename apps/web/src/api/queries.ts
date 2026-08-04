import { queryOptions } from "@tanstack/react-query"

import { fetchIncidentDetail, fetchIncidents } from "./incidents"
import { fetchInvestigationEvidence } from "./investigations"
import { startReplay } from "./replays"

// Ключи и опции запросов в одном месте: все три колонки главного экрана читают
// одно и то же выбранное событие, TanStack Query дедуплицирует их по ключу.

export const incidentsQueryOptions = queryOptions({
  queryKey: ["incidents"],
  queryFn: () => fetchIncidents(),
})

export function incidentDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["incidents", id],
    queryFn: () => fetchIncidentDetail(id),
  })
}

export function investigationEvidenceQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["investigations", id, "evidence"],
    queryFn: () => fetchInvestigationEvidence(id),
  })
}

// Эндпоинт — POST, но сценарий «неизменяемый» (ТЗ §12), поэтому читаем его
// как query: реплей проигрывается локальными таймерами без запросов на шаг,
// а ошибка «сценария нет» заранее гасит кнопку play на шкале.
export function replayScenarioQueryOptions(incidentId: string) {
  return queryOptions({
    queryKey: ["replays", incidentId],
    queryFn: () => startReplay(incidentId),
  })
}
