import { loadRuntimeBootstrap } from '../../prisma/seed/runtime-bootstrap.loader'
import {
  executeRuntimeBootstrap,
  type RuntimeBootstrapPersist,
  type RuntimeBootstrapRecompute,
} from '../../prisma/seed/runtime-bootstrap.orchestrator'
import {
  buildRuntimeBootstrapPlan,
  type RuntimeBootstrapPlan,
} from '../../prisma/seed/runtime-bootstrap.plan'
import type {
  RuntimeBootstrapPersistenceClient,
  RuntimeBootstrapPersistenceSummary,
} from '../../prisma/seed/runtime-bootstrap.persistence'
import { validateRuntimeBootstrap } from '../../prisma/seed/runtime-bootstrap.validator'

describe('runtime bootstrap orchestrator', () => {
  it('persists before recomputing all incidents and validates hashes', async () => {
    const plan = await loadPlan()
    const events: string[] = []

    const persistenceSummary =
      createPersistenceSummary()

    const persist: RuntimeBootstrapPersist = (
      client,
      receivedPlan,
    ) => {
      void client

      events.push('persist')

      expect(receivedPlan).toBe(plan)

      return Promise.resolve(
        persistenceSummary,
      )
    }

    const recompute: RuntimeBootstrapRecompute = (
      incidentId,
    ) => {
      events.push(`recompute:${incidentId}`)

      const incident = plan.incidents.find(
        ({ id }) => id === incidentId,
      )

      if (incident === undefined) {
        return Promise.reject(
          new Error(
            `Unexpected incident: ${incidentId}`,
          ),
        )
      }

      return Promise.resolve({
        id: `${incidentId}@runtime-test`,
        investigationId: incidentId,
        isCurrent: true,
        result: {
          inputHash:
            incident.metadata.runtimeBootstrap
              .fixtureInputHash,
          rulesetVersion:
            incident.metadata.runtimeBootstrap
              .rulesetVersion,
          evidenceLevel:
            incidentId ===
            'inv-atyrau-2025-05'
              ? 'L3'
              : incidentId ===
                  'inv-atyrau-2025-09'
                ? 'L2'
                : 'L0',
        },
      })
    }

    const summary =
      await executeRuntimeBootstrap({
        persistenceClient:
          unusedPersistenceClient(),
        plan,
        persist,
        recompute,
      })

    expect(events).toEqual([
      'persist',
      'recompute:inv-aktau-insufficient',
      'recompute:inv-atyrau-2025-05',
      'recompute:inv-atyrau-2025-09',
    ])

    expect(summary.persistence).toBe(
      persistenceSummary,
    )

    expect(
      summary.investigations.map(
        ({ incidentId, evidenceLevel }) => ({
          incidentId,
          evidenceLevel,
        }),
      ),
    ).toEqual([
      {
        incidentId:
          'inv-aktau-insufficient',
        evidenceLevel: 'L0',
      },
      {
        incidentId:
          'inv-atyrau-2025-05',
        evidenceLevel: 'L3',
      },
      {
        incidentId:
          'inv-atyrau-2025-09',
        evidenceLevel: 'L2',
      },
    ])
  })

  it('fails closed when recompute returns a different input hash', async () => {
    const plan = await loadPlan()

    const persist: RuntimeBootstrapPersist = (
      client,
      receivedPlan,
    ) => {
      void client
      void receivedPlan

      return Promise.resolve(
        createPersistenceSummary(),
      )
    }

    const recompute: RuntimeBootstrapRecompute = (
      incidentId,
    ) =>
      Promise.resolve({
        id: `${incidentId}@invalid`,
        investigationId: incidentId,
        isCurrent: true,
        result: {
          inputHash: '0'.repeat(64),
          rulesetVersion: '1.2.1',
          evidenceLevel: 'L0',
        },
      })

    await expect(
      executeRuntimeBootstrap({
        persistenceClient:
          unusedPersistenceClient(),
        plan,
        persist,
        recompute,
      }),
    ).rejects.toMatchObject({
      code:
        'RUNTIME_BOOTSTRAP_RECOMPUTE_MISMATCH',
    })
  })
})

async function loadPlan(): Promise<RuntimeBootstrapPlan> {
  return buildRuntimeBootstrapPlan(
    validateRuntimeBootstrap(
      await loadRuntimeBootstrap(),
    ),
  )
}

function createPersistenceSummary(): RuntimeBootstrapPersistenceSummary {
  return {
    prerequisites: {
      sourceDocuments: 2,
      stations: 4,
      stationRelations: 3,
      stationRelationEvidence: 4,
      measurements: 6,
    },
    sourceDocuments: 3,
    stationRelations: 3,
    incidents: 3,
    incidentSignals: 1,
    incidentSignalLinks: 1,
    candidateObjects: 1,
    candidateObjectSources: 2,
  }
}

function unusedPersistenceClient(): RuntimeBootstrapPersistenceClient {
  return {
    $transaction<T>(): Promise<T> {
      return Promise.reject(
        new Error(
          'Unexpected persistence transaction',
        ),
      )
    },
  }
}
