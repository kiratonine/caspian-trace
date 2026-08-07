import { ReplayScenarioSchema } from "@caspian-trace/contracts"

import { apiPost, IS_SEED_MODE, parseSeed, warnStubOnce } from "./client"
import type { ReplayScenario } from "./contracts"
import { replayScenarios } from "./seed-data"

// POST /api/replays/:id/start — неизменяемый сценарий реплея, отдаёт full-stack 2.
// STUB: ветка seed остаётся аварийным офлайн-режимом и после интеграции;
// в ней есть только сентябрьский сценарий.
export async function startReplay(
  incidentId: string,
  signal?: AbortSignal
): Promise<ReplayScenario> {
  if (IS_SEED_MODE) {
    warnStubOnce(
      "POST /api/replays/:id/start — сентябрьский сценарий из ТЗ §14"
    )
    const scenario = replayScenarios[incidentId]
    if (!scenario)
      throw new Error(`Для события «${incidentId}» нет сценария реплея`)
    return parseSeed(
      ReplayScenarioSchema,
      scenario,
      `POST /api/replays/${incidentId}/start`
    )
  }

  return apiPost(
    `/replays/${encodeURIComponent(incidentId)}/start`,
    ReplayScenarioSchema,
    { signal }
  )
}
