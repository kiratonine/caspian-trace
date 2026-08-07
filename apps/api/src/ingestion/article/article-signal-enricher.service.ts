import { Injectable } from '@nestjs/common'

import { LlmService } from '../../llm/llm.service'
import type {
    ArticleSignalCandidate,
    ArticleSignalEnrichmentInput,
} from './article-signal-candidate'

@Injectable()
export class ArticleSignalEnricher {
    constructor(private readonly llm: LlmService) { }

    async enrich(
        input: ArticleSignalEnrichmentInput,
    ): Promise<ArticleSignalCandidate | null> {
        const sourceText = input.sourceText.trim()

        if (sourceText.length === 0) {
            return null
        }

        const signal = await this.llm.extractIncidentSignal({
            sourceText,
        })

        if (signal === null) {
            return null
        }

        return {
            sourceDocumentId: input.sourceDocumentId,
            extractionMode: 'llm_candidate',
            verificationStatus: 'unverified',
            signal,
        }
    }
}