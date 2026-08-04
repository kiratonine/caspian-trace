import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { Injectable } from '@nestjs/common'

import type {
  InvestigationInput,
  InvestigationResult,
} from '@caspian-trace/investigation-core'

import type {
  InvestigationInputReader,
  InvestigationResultWriter,
  StoredInvestigation,
} from './investigation.ports'

const FIXTURE_NAMES: Readonly<Record<string, string>> = {
  'inv-atyrau-2025-09': 'september-input.json',
  'inv-atyrau-2025-05': 'may-input.json',
  'inv-aktau-insufficient': 'aktau-input.json',
}

/** Fixture adapter used until Backend 1 supplies the Prisma repository. */
@Injectable()
export class FileInvestigationRepository
  implements InvestigationInputReader, InvestigationResultWriter
{
  private readonly versions = new Map<string, StoredInvestigation[]>()

  async loadInput(investigationId: string): Promise<InvestigationInput | null> {
    const filename = FIXTURE_NAMES[investigationId]
    if (filename === undefined) return null
    const path = resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'data',
      'fixtures',
      'investigation',
      filename,
    )
    const raw: unknown = JSON.parse(await readFile(path, 'utf8'))
    return assertFixtureInput(raw)
  }

  findCurrent(investigationId: string): Promise<StoredInvestigation | null> {
    const current = this.versions
      .get(investigationId)
      ?.find(({ isCurrent }) => isCurrent)
    return Promise.resolve(current === undefined ? null : structuredClone(current))
  }

  saveVersioned(
    investigationId: string,
    input: InvestigationInput,
    result: InvestigationResult,
  ): Promise<StoredInvestigation> {
    const previous = this.versions.get(investigationId) ?? []
    const stored: StoredInvestigation = {
      id: `${investigationId}@${result.rulesetVersion}:${result.inputHash.slice(0, 12)}`,
      investigationId,
      input: structuredClone(input),
      result: structuredClone(result),
      generatedAt: new Date().toISOString(),
      isCurrent: true,
    }
    this.versions.set(investigationId, [
      ...previous.map((version) => ({ ...version, isCurrent: false })),
      stored,
    ])
    return Promise.resolve(structuredClone(stored))
  }
}

function assertFixtureInput(value: unknown): InvestigationInput {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('incident' in value) ||
    !('measurements' in value) ||
    !Array.isArray(value.measurements)
  ) {
    throw new Error('INVALID_INVESTIGATION_FIXTURE')
  }
  return value as InvestigationInput
}
