import type { EvidenceGraph } from "./contracts"
import { warnStubOnce } from "./client"
import { evidenceGraphs } from "./seed-data"

// STUB: заменить на GET /api/investigations/:id/evidence (apiGet из ./client),
// отдаёт full-stack 2.
export async function fetchInvestigationEvidence(
  id: string
): Promise<EvidenceGraph> {
  warnStubOnce("GET /api/investigations/:id/evidence — данные из ТЗ §5")
  const graph = evidenceGraphs[id]
  if (!graph) throw new Error(`Расследование «${id}» не найдено`)
  return { investigationId: id, ...graph }
}
