import type { ReplayScenario } from "./contracts"
import { apiPost } from "./client"

export async function startReplay(incidentId: string): Promise<ReplayScenario> {
  return apiPost<ReplayScenario>(
    `/replays/${encodeURIComponent(incidentId)}/start`
  )
}
