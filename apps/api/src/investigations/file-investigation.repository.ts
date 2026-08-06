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
import { parseInvestigationInput } from './investigation-input.schema'

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

  async loadInput(referenceId: string): Promise<InvestigationInput | null> {
    let investigationId = referenceId
    for (const [candidateId, versions] of this.versions.entries()) {
      if (versions.some(({ id, isCurrent }) => id === referenceId && isCurrent)) {
        investigationId = candidateId
        break
      }
    }
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
    return parseInvestigationInput(raw)
  }

  findCurrent(referenceId: string): Promise<StoredInvestigation | null> {
    const currentByIncident = this.versions
      .get(referenceId)
      ?.find(({ isCurrent }) => isCurrent)
    if (currentByIncident !== undefined) {
      return Promise.resolve(structuredClone(currentByIncident))
    }

    for (const versions of this.versions.values()) {
      const currentByVersion = versions.find(
        ({ id, isCurrent }) => id === referenceId && isCurrent,
      )
      if (currentByVersion !== undefined) {
        return Promise.resolve(structuredClone(currentByVersion))
      }
    }
    return Promise.resolve(null)
  }

  saveVersioned(
    investigationId: string,
    input: InvestigationInput,
    result: InvestigationResult,
  ): Promise<StoredInvestigation> {
    const previous = this.versions.get(investigationId) ?? []
    const current = previous.find(({ isCurrent }) => isCurrent)
    if (
      current?.result.inputHash === result.inputHash &&
      current.result.rulesetVersion === result.rulesetVersion
    ) {
      return Promise.resolve(structuredClone(current))
    }
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
