import { RuntimeBootstrapError } from './runtime-bootstrap.errors'
import { loadRuntimeBootstrap } from './runtime-bootstrap.loader'
import {
  buildRuntimeBootstrapPlan,
  type RuntimeBootstrapPlan,
} from './runtime-bootstrap.plan'
import {
  persistRuntimeBootstrapPlan,
  type RuntimeBootstrapPersistenceClient,
  type RuntimeBootstrapPersistenceSummary,
} from './runtime-bootstrap.persistence'
import { validateRuntimeBootstrap } from './runtime-bootstrap.validator'

export interface RuntimeBootstrapRecomputedVersion {
  id: string
  investigationId: string
  isCurrent: boolean
  result: {
    inputHash: string
    rulesetVersion: string
    evidenceLevel: string
  }
}

export type RuntimeBootstrapRecompute = (
  incidentId: string,
) => Promise<RuntimeBootstrapRecomputedVersion>

export type RuntimeBootstrapPersist = (
  client: RuntimeBootstrapPersistenceClient,
  plan: RuntimeBootstrapPlan,
) => Promise<RuntimeBootstrapPersistenceSummary>

export interface RuntimeBootstrapInvestigationSummary {
  incidentId: string
  investigationVersionId: string
  inputHash: string
  rulesetVersion: string
  evidenceLevel: string
  isCurrent: boolean
}

export interface RuntimeBootstrapExecutionSummary {
  plan: {
    incidents: number
    sourceDocuments: number
    signals: number
    candidateObjects: number
  }
  persistence: RuntimeBootstrapPersistenceSummary
  investigations: RuntimeBootstrapInvestigationSummary[]
}

interface ExecuteRuntimeBootstrapOptions {
  persistenceClient: RuntimeBootstrapPersistenceClient
  plan: RuntimeBootstrapPlan
  recompute: RuntimeBootstrapRecompute
  persist?: RuntimeBootstrapPersist
}

export interface RunRuntimeBootstrapOptions {
  repositoryRoot?: string
}

export async function runRuntimeBootstrap(
  persistenceClient: RuntimeBootstrapPersistenceClient,
  recompute: RuntimeBootstrapRecompute,
  options: RunRuntimeBootstrapOptions = {},
): Promise<RuntimeBootstrapExecutionSummary> {
  const loaded = await loadRuntimeBootstrap({
    repositoryRoot: options.repositoryRoot,
  })
  const validated = validateRuntimeBootstrap(loaded)
  const plan = buildRuntimeBootstrapPlan(validated)

  return executeRuntimeBootstrap({
    persistenceClient,
    plan,
    recompute,
  })
}

export async function executeRuntimeBootstrap({
  persistenceClient,
  plan,
  recompute,
  persist = persistRuntimeBootstrapPlan,
}: ExecuteRuntimeBootstrapOptions): Promise<RuntimeBootstrapExecutionSummary> {
  const persistence = await persist(
    persistenceClient,
    plan,
  )

  const investigations: RuntimeBootstrapInvestigationSummary[] = []

  const incidents = [...plan.incidents].sort(
    (left, right) => left.id.localeCompare(right.id),
  )

  for (const incident of incidents) {
    const expected =
      incident.metadata.runtimeBootstrap

    const stored = await recompute(incident.id)

    assertRecomputedVersion(
      incident.id,
      expected.fixtureInputHash,
      expected.rulesetVersion,
      stored,
    )

    investigations.push({
      incidentId: incident.id,
      investigationVersionId: stored.id,
      inputHash: stored.result.inputHash,
      rulesetVersion: stored.result.rulesetVersion,
      evidenceLevel: stored.result.evidenceLevel,
      isCurrent: stored.isCurrent,
    })
  }

  return {
    plan: {
      incidents: plan.incidents.length,
      sourceDocuments: plan.sourceDocuments.length,
      signals: plan.signals.length,
      candidateObjects: plan.candidateObjects.length,
    },
    persistence,
    investigations,
  }
}

function assertRecomputedVersion(
  expectedIncidentId: string,
  expectedInputHash: string,
  expectedRulesetVersion: string,
  stored: RuntimeBootstrapRecomputedVersion,
): void {
  if (stored.investigationId !== expectedIncidentId) {
    throw recomputeMismatch(
      `Incident mismatch for ${expectedIncidentId}`,
    )
  }

  if (stored.result.inputHash !== expectedInputHash) {
    throw recomputeMismatch(
      `Input hash mismatch for ${expectedIncidentId}`,
    )
  }

  if (
    stored.result.rulesetVersion !==
    expectedRulesetVersion
  ) {
    throw recomputeMismatch(
      `Ruleset version mismatch for ${expectedIncidentId}`,
    )
  }

  if (!stored.isCurrent) {
    throw recomputeMismatch(
      `Recomputed investigation is not current: ${expectedIncidentId}`,
    )
  }
}

function recomputeMismatch(
  message: string,
): RuntimeBootstrapError {
  return new RuntimeBootstrapError(
    'RUNTIME_BOOTSTRAP_RECOMPUTE_MISMATCH',
    message,
  )
}
