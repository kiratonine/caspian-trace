import type {
  InvestigationInput,
  InvestigationResult,
} from '@caspian-trace/investigation-core'

export const INVESTIGATION_INPUT_READER = Symbol('INVESTIGATION_INPUT_READER')
export const INVESTIGATION_RESULT_WRITER = Symbol('INVESTIGATION_RESULT_WRITER')

export type StoredInvestigation = {
  id: string
  investigationId: string
  input: InvestigationInput
  result: InvestigationResult
  generatedAt: string
  isCurrent: boolean
}

export interface InvestigationInputReader {
  loadInput(investigationId: string): Promise<InvestigationInput | null>
}

export interface InvestigationResultWriter {
  findCurrent(investigationId: string): Promise<StoredInvestigation | null>
  saveVersioned(
    investigationId: string,
    input: InvestigationInput,
    result: InvestigationResult,
  ): Promise<StoredInvestigation>
}
