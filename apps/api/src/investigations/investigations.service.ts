import { Inject, Injectable, NotFoundException } from '@nestjs/common'

import {
  canonicalizeInvestigationInput,
  runInvestigation,
  type InvestigationResult,
} from '@caspian-trace/investigation-core'
import type { EvidenceGraph } from '@caspian-trace/contracts'

import { toEvidenceGraph } from './evidence.mapper'
import {
  INVESTIGATION_INPUT_READER,
  INVESTIGATION_RESULT_WRITER,
  type InvestigationInputReader,
  type InvestigationResultWriter,
  type StoredInvestigation,
} from './investigation.ports'

@Injectable()
export class InvestigationsService {
  constructor(
    @Inject(INVESTIGATION_INPUT_READER)
    private readonly inputReader: InvestigationInputReader,
    @Inject(INVESTIGATION_RESULT_WRITER)
    private readonly resultWriter: InvestigationResultWriter,
  ) {}

  async recompute(investigationId: string): Promise<StoredInvestigation> {
    const loadedInput = await this.inputReader.loadInput(investigationId)
    if (loadedInput === null) throw investigationNotFound(investigationId)
    const input = canonicalizeInvestigationInput(loadedInput)
    const result = runInvestigation(input)
    const current = await this.resultWriter.findCurrent(investigationId)
    if (
      current?.result.inputHash === result.inputHash &&
      current.result.rulesetVersion === result.rulesetVersion
    ) {
      return current
    }
    return this.resultWriter.saveVersioned(investigationId, input, result)
  }

  async getEvidenceGraph(investigationId: string): Promise<EvidenceGraph> {
    return toEvidenceGraph(await this.recompute(investigationId))
  }

  async getCurrentResult(investigationId: string): Promise<InvestigationResult> {
    return (await this.recompute(investigationId)).result
  }

  async getStored(investigationId: string): Promise<StoredInvestigation> {
    return this.recompute(investigationId)
  }
}

function investigationNotFound(id: string): NotFoundException {
  return new NotFoundException({
    code: 'INVESTIGATION_NOT_FOUND',
    message: `Investigation ${id} was not found`,
  })
}
