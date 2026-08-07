import {
  IncidentDetailSchema,
  IncidentSummaryListSchema,
} from "@caspian-trace/contracts"

import { MAX_INCIDENTS_LIMIT } from "@/constants/api"
import { apiGet, IS_SEED_MODE, parseSeed, warnStubOnce } from "./client"
import type {
  IncidentDetail,
  IncidentListParams,
  IncidentSummary,
} from "./contracts"
import { incidentDetails, incidentSummaries } from "./seed-data"

// GET /api/incidents — список событий (роадмап §9.1), отдаёт full-stack 1.
// STUB: ветка seed остаётся аварийным офлайн-режимом и после интеграции.
export async function fetchIncidents(
  params: IncidentListParams = {},
  signal?: AbortSignal
): Promise<IncidentSummary[]> {
  const limit = Math.min(
    params.limit ?? MAX_INCIDENTS_LIMIT,
    MAX_INCIDENTS_LIMIT
  )

  if (IS_SEED_MODE) {
    warnStubOnce("GET /api/incidents — данные из ТЗ §5")
    // Параметры from/to заглушка игнорирует — в данных всего три события.
    const filtered = incidentSummaries
      .filter((incident) =>
        params.status ? incident.evidenceLevel === params.status : true
      )
      .filter((incident) =>
        params.region ? incident.region === params.region : true
      )
      .slice(0, limit)
    return parseSeed(IncidentSummaryListSchema, filtered, "GET /api/incidents")
  }

  return apiGet("/incidents", IncidentSummaryListSchema, {
    params: { ...params, limit },
    signal,
  })
}

// GET /api/incidents/:id — событие, сигналы, измерения и краткий вывод (§9.2).
// STUB: ветка seed остаётся аварийным офлайн-режимом и после интеграции.
export async function fetchIncidentDetail(
  id: string,
  signal?: AbortSignal
): Promise<IncidentDetail> {
  if (IS_SEED_MODE) {
    warnStubOnce("GET /api/incidents/:id — данные из ТЗ §5")
    const detail = incidentDetails[id]
    if (!detail) throw new Error(`Событие «${id}» не найдено`)
    return parseSeed(IncidentDetailSchema, detail, `GET /api/incidents/${id}`)
  }

  return apiGet(`/incidents/${encodeURIComponent(id)}`, IncidentDetailSchema, {
    signal,
  })
}
