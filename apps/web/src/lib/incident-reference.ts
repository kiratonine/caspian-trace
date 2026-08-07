import type { ReplayScenario } from "@/api/contracts"

const VERSIONED_INCIDENT_SUFFIX = /@[^:]+:[a-f0-9]{64}$/u

/** Stable incident ID for either a stable or a validated versioned reference. */
export function stableIncidentReference(reference: string): string {
  return reference.replace(VERSIONED_INCIDENT_SUFFIX, "")
}

/** Whether two URL/API references point to the same stable incident. */
export function sameIncidentReference(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  if (!left || !right) return false

  return (
    left === right ||
    stableIncidentReference(left) === stableIncidentReference(right)
  )
}

/** A replay may expose the versioned investigation and stable incident IDs. */
export function replayScenarioMatchesReference(
  scenario: Pick<ReplayScenario, "id" | "incidentId">,
  reference: string | null | undefined
): boolean {
  return (
    sameIncidentReference(scenario.id, reference) ||
    sameIncidentReference(scenario.incidentId, reference)
  )
}
