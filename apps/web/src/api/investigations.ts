import type { EvidenceGraph } from "./contracts"
import { apiGet } from "./client"

export async function fetchInvestigationEvidence(
  id: string
): Promise<EvidenceGraph> {
  return apiGet<EvidenceGraph>(
    `/investigations/${encodeURIComponent(id)}/evidence`
  )
}
