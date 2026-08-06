import type { ExtractedSignal } from '../../llm/schemas/llm.schemas'

export interface ArticleSignalCandidate {
    sourceDocumentId: string
    extractionMode: 'llm_candidate'
    verificationStatus: 'unverified'
    signal: ExtractedSignal
}

export interface ArticleSignalEnrichmentInput {
    sourceDocumentId: string
    sourceText: string
}