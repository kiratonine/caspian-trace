import { queryOptions } from "@tanstack/react-query"

import { LIVE_STATUS_STALE_TIME_MS } from "@/constants/api"
import type { IncidentListParams } from "./contracts"
import { fetchIncidentDetail, fetchIncidents } from "./incidents"
import { fetchLiveStatus } from "./live-status"
import { startReplay } from "./replays"

// Ключи и опции запросов в одном месте: все три колонки главного экрана читают
// одно и то же выбранное событие, TanStack Query дедуплицирует их по ключу.
//
// Ключи собираются фабрикой, а не литералами по месту: опечатка в строке ключа
// не ломает сборку, зато молча заводит второй кэш того же запроса.
export const queryKeys = {
  incidents: (filters: IncidentListParams = {}) =>
    ["incidents", filters] as const,
  incident: (id: string) => ["incidents", id] as const,
  evidence: (id: string) => ["evidence", id] as const,
  replay: (id: string) => ["replays", id] as const,
  liveStatus: () => ["live-status"] as const,
}

export const incidentsQueryOptions = queryOptions({
  queryKey: queryKeys.incidents(),
  queryFn: ({ signal }) => fetchIncidents({}, signal),
})

export function incidentDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: queryKeys.incident(id),
    queryFn: ({ signal }) => fetchIncidentDetail(id, signal),
  })
}

// Эндпоинт — POST, но сценарий «неизменяемый» (ТЗ §12), поэтому читаем его
// как query: реплей проигрывается локальными таймерами без запросов на шаг,
// а ошибка «сценария нет» заранее гасит кнопку play на шкале.
export function replayScenarioQueryOptions(incidentId: string) {
  return queryOptions({
    queryKey: queryKeys.replay(incidentId),
    queryFn: ({ signal }) => startReplay(incidentId, signal),
  })
}

// Единственный запрос со своим `staleTime`: состояние источников — то немногое,
// что во время показа может измениться (F6).
export const liveStatusQueryOptions = queryOptions({
  queryKey: queryKeys.liveStatus(),
  queryFn: ({ signal }) => fetchLiveStatus(signal),
  staleTime: LIVE_STATUS_STALE_TIME_MS,
})
