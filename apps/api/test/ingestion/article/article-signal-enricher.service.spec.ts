import { Test } from '@nestjs/testing'

import { ArticleSignalEnricher } from '../../../src/ingestion/article/article-signal-enricher.service'
import { LlmModule } from '../../../src/llm/llm.module'
import { LlmService } from '../../../src/llm/llm.service'
import type { ExtractedSignal } from '../../../src/llm/schemas/llm.schemas'

describe('ArticleSignalEnricher', () => {
    const extractIncidentSignal = jest.fn()

    let enricher: ArticleSignalEnricher

    beforeEach(async () => {
        extractIncidentSignal.mockReset()

        const module = await Test.createTestingModule({
            providers: [
                ArticleSignalEnricher,
                {
                    provide: LlmService,
                    useValue: {
                        extractIncidentSignal,
                    },
                },
            ],
        }).compile()

        enricher = module.get(ArticleSignalEnricher)
    })

    it('returns null for blank source text without calling LLM', async () => {
        await expect(
            enricher.enrich({
                sourceDocumentId: 'source-1',
                sourceText: '   ',
            }),
        ).resolves.toBeNull()

        expect(extractIncidentSignal).not.toHaveBeenCalled()
    })

    it('returns null when the provider produces no signal', async () => {
        extractIncidentSignal.mockResolvedValueOnce(null)

        await expect(
            enricher.enrich({
                sourceDocumentId: 'source-1',
                sourceText:
                    'В Жайыке обнаружена нефтяная плёнка.',
            }),
        ).resolves.toBeNull()

        expect(extractIncidentSignal).toHaveBeenCalledWith({
            sourceText:
                'В Жайыке обнаружена нефтяная плёнка.',
        })
    })

    it('returns an unverified transient candidate', async () => {
        const signal: ExtractedSignal = {
            observedAt: null,
            observedPeriod: '2025-09',
            locationText: 'Жайык, Атырау',
            phenomenon: 'oil_film',
            excerpt:
                'В сентябре 2025 года на Жайыке обнаружена нефтяная плёнка.',
            evidenceQuotes: [
                'обнаружена нефтяная плёнка',
            ],
            confidence: 0.91,
        }

        extractIncidentSignal.mockResolvedValueOnce(signal)

        await expect(
            enricher.enrich({
                sourceDocumentId: 'source-1',
                sourceText:
                    'В сентябре 2025 года на Жайыке обнаружена нефтяная плёнка.',
            }),
        ).resolves.toEqual({
            sourceDocumentId: 'source-1',
            extractionMode: 'llm_candidate',
            verificationStatus: 'unverified',
            signal,
        })
    })

    it('propagates LLM validation failures', async () => {
        extractIncidentSignal.mockRejectedValueOnce(
            new Error('LLM_QUOTE_NOT_FOUND'),
        )

        await expect(
            enricher.enrich({
                sourceDocumentId: 'source-1',
                sourceText: 'Исходный текст статьи.',
            }),
        ).rejects.toThrow('LLM_QUOTE_NOT_FOUND')
    })
})

describe('ArticleSignalEnricher with disabled provider', () => {
    it('returns null without an external transport', async () => {
        const module = await Test.createTestingModule({
            imports: [LlmModule],
            providers: [ArticleSignalEnricher],
        }).compile()

        const enricher = module.get(ArticleSignalEnricher)

        await expect(
            enricher.enrich({
                sourceDocumentId: 'source-disabled',
                sourceText:
                    'В сентябре 2025 года на Жайыке обнаружена нефтяная плёнка.',
            }),
        ).resolves.toBeNull()
    })
})