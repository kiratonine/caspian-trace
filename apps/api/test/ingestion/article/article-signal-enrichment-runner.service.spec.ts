import { ArticleSignalEnrichmentRunner } from '../../../src/ingestion/article/article-signal-enrichment-runner.service'
import type { ArticleSignalCandidate } from '../../../src/ingestion/article/article-signal-candidate'

const input = {
    sourceDocumentId: 'source-1',
    sourceText:
        'В сентябре 2025 года на Жайыке обнаружена нефтяная плёнка.',
}

const candidate: ArticleSignalCandidate = {
    sourceDocumentId: 'source-1',
    extractionMode: 'llm_candidate',
    verificationStatus: 'unverified',
    signal: {
        observedAt: null,
        observedPeriod: '2025-09',
        locationText: 'Жайык, Атырау',
        phenomenon: 'oil_film',
        excerpt: input.sourceText,
        evidenceQuotes: [
            'обнаружена нефтяная плёнка',
        ],
        confidence: 0.91,
    },
}

describe('ArticleSignalEnrichmentRunner', () => {
    const enrich = jest.fn()
    const runner = new ArticleSignalEnrichmentRunner({
        enrich,
    } as never)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns a transient candidate', async () => {
        enrich.mockResolvedValueOnce(candidate)

        await expect(runner.run(input)).resolves.toEqual({
            candidate,
            failed: false,
        })
    })

    it('keeps null as a successful optional result', async () => {
        enrich.mockResolvedValueOnce(null)

        await expect(runner.run(input)).resolves.toEqual({
            candidate: null,
            failed: false,
        })
    })

    it('isolates provider and validation failures', async () => {
        enrich.mockRejectedValueOnce(
            new Error('LLM_QUOTE_NOT_FOUND'),
        )

        await expect(runner.run(input)).resolves.toEqual({
            candidate: null,
            failed: true,
        })
    })
})