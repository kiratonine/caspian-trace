import { MAX_INCIDENTS_LIMIT } from "@/constants/api"
import type {
  IncidentDetail,
  IncidentListParams,
  IncidentSummary,
} from "./contracts"
import { warnStubOnce } from "./client"
import { incidentDetails, incidentSummaries } from "./seed-data"

// STUB: заменить на GET /api/incidents (apiGet из ./client), отдаёт full-stack 1.
// Параметры from/to заглушка игнорирует — в данных всего три события.
export async function fetchIncidents(
  params: IncidentListParams = {}
): Promise<IncidentSummary[]> {
  warnStubOnce("GET /api/incidents — данные из ТЗ §5")
  const limit = Math.min(
    params.limit ?? MAX_INCIDENTS_LIMIT,
    MAX_INCIDENTS_LIMIT
  )
  return incidentSummaries
    .filter((incident) =>
      params.status ? incident.evidenceLevel === params.status : true
    )
    .filter((incident) =>
      params.region ? incident.region === params.region : true
    )
    .slice(0, limit)
}

// STUB: заменить на GET /api/incidents/:id (apiGet из ./client), отдаёт full-stack 1.
export async function fetchIncidentDetail(id: string): Promise<IncidentDetail> {
  warnStubOnce("GET /api/incidents/:id — данные из ТЗ §5")
  const detail = incidentDetails[id]
  if (!detail) throw new Error(`Событие «${id}» не найдено`)
  return detail
}
