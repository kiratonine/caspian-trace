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
 * Canonical representation used by both hashing and rule evaluation.
 *
 * Collections that are semantically sets are sorted.
 * Equivalent ISO timestamps are normalized to UTC.
 * Missing and empty incident unknown collections are treated identically.
 */
export function canonicalizeInvestigationInput(
  input: InvestigationInput,
): InvestigationInput {
  return {
    ...input,
    incident: {
      ...input.incident,
      unknowns: [...(input.incident.unknowns ?? [])].sort(compareUnknowns),
    },
    signals: sortById(input.signals).map((signal) => ({
      ...signal,
      observedAt: normalizeIsoDateTime(signal.observedAt),
      reportedAt: normalizeIsoDateTime(signal.reportedAt),
    })),
    stations: sortById(input.stations),
    stationRelations: sortById(input.stationRelations),
    measurements: sortById(input.measurements).map((measurement) => ({
      ...measurement,
      sampledAt: normalizeIsoDateTime(measurement.sampledAt),
    })),
    candidateObjects: sortById(input.candidateObjects).map((candidate) => ({
      ...candidate,
      evidenceDocumentIds: [...candidate.evidenceDocumentIds].sort(),
    })),
    sourceDocuments: sortById(input.sourceDocuments).map((source) => ({
      ...source,
      publishedAt: normalizeIsoDateTime(source.publishedAt),
      fetchedAt: normalizeIsoDateTime(source.fetchedAt),
    })),
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

function normalizeIsoDateTime(value: string): string
function normalizeIsoDateTime(value: string | null): string | null
function normalizeIsoDateTime(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('INVALID_INVESTIGATION_DATETIME')
  }

  return parsed.toISOString()
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