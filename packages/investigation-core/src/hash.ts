import { createHash } from 'node:crypto'

import type { InvestigationInput } from './types'

export function calculateInputHash(input: InvestigationInput): string {
  return createHash('sha256').update(stableStringify(canonicalizeInput(input))).digest('hex')
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value))
}

function canonicalizeInput(input: InvestigationInput): InvestigationInput {
  return {
    ...input,
    signals: sortById(input.signals),
    stations: sortById(input.stations),
    stationRelations: sortById(input.stationRelations),
    measurements: sortById(input.measurements),
    candidateObjects: sortById(input.candidateObjects),
    sourceDocuments: sortById(input.sourceDocuments),
  }
}

function sortById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id))
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
