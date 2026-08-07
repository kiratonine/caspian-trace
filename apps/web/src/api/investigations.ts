import { EvidenceGraphSchema } from "@caspian-trace/contracts"

import { apiGet, IS_SEED_MODE, parseSeed, warnStubOnce } from "./client"
import type { EvidenceGraph } from "./contracts"
import { evidenceGraphs } from "./seed-data"

// GET /api/investigations/:id/evidence — полный граф доказательств,
// отдаёт full-stack 2.
// STUB: ветка seed остаётся аварийным офлайн-режимом и после интеграции.
export async function fetchInvestigationEvidence(
  id: string,
  signal?: AbortSignal
): Promise<EvidenceGraph> {
  if (IS_SEED_MODE) {
    warnStubOnce("GET /api/investigations/:id/evidence — данные из ТЗ §5")
    const graph = evidenceGraphs[id]
    if (!graph) throw new Error(`Расследование «${id}» не найдено`)
    return parseSeed(
      EvidenceGraphSchema,
      { investigationId: id, ...graph },
      `GET /api/investigations/${id}/evidence`
    )
  }

  return apiGet(
    `/investigations/${encodeURIComponent(id)}/evidence`,
    EvidenceGraphSchema,
    { signal }
  )
}
