import { Injectable } from '@nestjs/common'

import type {
    ArticleSignalEnrichmentInput,
    ArticleSignalEnrichmentOutcome,
} from './article-signal-candidate'
import { ArticleSignalEnricher } from './article-signal-enricher.service'

@Injectable()
export class ArticleSignalEnrichmentRunner {
    constructor(
        private readonly enricher: ArticleSignalEnricher,
    ) { }

    async run(
        input: ArticleSignalEnrichmentInput,
    ): Promise<ArticleSignalEnrichmentOutcome> {
        try {
            return {
                candidate: await this.enricher.enrich(input),
                failed: false,
            }
        } catch {
            return {
                candidate: null,
                failed: true,
            }
        }
    }
}