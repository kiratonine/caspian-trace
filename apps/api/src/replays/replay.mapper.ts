import { ReplayScenarioSchema, type ReplayScenario } from '@caspian-trace/contracts'

import { toIncidentSignal, toMeasurement } from '../investigations/evidence.mapper'
import type { StoredInvestigation } from '../investigations/investigation.ports'

export function toReplayScenario(stored: StoredInvestigation): ReplayScenario {
  const signal = stored.input.signals[0]
  const primarySource = stored.input.sourceDocuments.find(
    ({ id }) => id === signal?.sourceDocumentId,
  ) ?? stored.input.sourceDocuments[0]

  const steps: ReplayScenario['steps'] = []
  let offsetMs = 0
  if (signal !== undefined) {
    steps.push({
      id: `${stored.investigationId}-signal`,
      offsetMs,
      type: 'signal',
      payload: { signal: toIncidentSignal(signal), evidenceLevel: 'L1' },
    })
    offsetMs += 1200
  }
  if (primarySource !== undefined) {
    steps.push({
      id: `${stored.investigationId}-corroboration`,
      offsetMs,
      type: 'corroboration',
      payload: {
        text: `Источник «${primarySource.title}» включён в доказательную базу.`,
        sourceDocumentId: primarySource.id,
        evidenceLevel: signal === undefined ? 'L1' : 'L2',
      },
    })
    offsetMs += 1200
  }
  if (stored.input.measurements.length > 0) {
    steps.push({
      id: `${stored.investigationId}-measurements`,
      offsetMs,
      type: 'measurement',
      payload: {
        measurements: stored.input.measurements.map(toMeasurement),
        evidenceLevel: 'L2',
      },
    })
    offsetMs += 1200
  }
  for (const statement of [
    ...stored.result.supportedFacts,
    ...stored.result.contradictedHypotheses,
  ]) {
    steps.push({
      id: `${stored.investigationId}-inference-${statement.id}`,
      offsetMs,
      type: 'inference',
      payload: { text: statement.text, evidenceLevel: stored.result.evidenceLevel },
    })
    offsetMs += 1200
  }
  steps.push({
    id: `${stored.investigationId}-conclusion`,
    offsetMs,
    type: 'conclusion',
    payload: {
      text: stored.result.conclusion,
      evidenceLevel: stored.result.evidenceLevel,
    },
  })

  validateReferences(stored, steps)
  return ReplayScenarioSchema.parse({
    id: stored.investigationId,
    incidentId: stored.input.incident.id,
    steps,
  })
}

function validateReferences(
  stored: StoredInvestigation,
  steps: ReplayScenario['steps'],
): void {
  const measurementIds = new Set(stored.input.measurements.map(({ id }) => id))
  const sourceIds = new Set(stored.input.sourceDocuments.map(({ id }) => id))
  for (const step of steps) {
    if (step.type === 'measurement') {
      if (step.payload.measurements.some(({ id }) => !measurementIds.has(id))) {
        throw new Error('REPLAY_UNKNOWN_MEASUREMENT')
      }
    }
    if (
      step.type === 'corroboration' &&
      !sourceIds.has(step.payload.sourceDocumentId)
    ) {
      throw new Error('REPLAY_UNKNOWN_SOURCE')
    }
  }
}
