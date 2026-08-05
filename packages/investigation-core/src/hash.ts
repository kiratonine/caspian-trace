import { createHash } from 'node:crypto'

import type { InvestigationInput } from './types'

export function calculateInputHash(input: InvestigationInput): string {
  return createHash('sha256')
    .update(stableStringify(canonicalizeInvestigationInput(input)))
    .digest('hex')
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value))
}

/**
 * Canonical order for every collection that is semantically a set.
 * The same canonical value is used by both hashing and rule evaluation so an
 * input permutation cannot keep the hash while changing the result.
 */
export function canonicalizeInvestigationInput(
  input: InvestigationInput,
): InvestigationInput {
  return {
    ...input,
    incident: {
      ...input.incident,
      unknowns:
        input.incident.unknowns === undefined
          ? undefined
          : [...input.incident.unknowns].sort(compareUnknowns),
    },
    signals: sortById(input.signals),
    stations: sortById(input.stations),
    stationRelations: sortById(input.stationRelations),
    measurements: sortById(input.measurements),
    candidateObjects: sortById(input.candidateObjects).map((candidate) => ({
      ...candidate,
      evidenceDocumentIds: [...candidate.evidenceDocumentIds].sort(),
    })),
    sourceDocuments: sortById(input.sourceDocuments),
  }
}

function sortById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id))
}

function compareUnknowns(
  a: NonNullable<InvestigationInput['incident']['unknowns']>[number],
  b: NonNullable<InvestigationInput['incident']['unknowns']>[number],
): number {
  return a.code.localeCompare(b.code) || a.text.localeCompare(b.text)
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys)
  if (typeof value !== 'object' || value === null) return value
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sortObjectKeys(record[key])]),
  )
}
