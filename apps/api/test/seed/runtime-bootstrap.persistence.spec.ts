import type { Prisma } from '../../src/generated/prisma/client'
import {
  SourceDocumentStatus,
} from '../../src/generated/prisma/enums'
import {
  persistRuntimeBootstrapPlan,
  type RuntimeBootstrapPersistenceClient,
} from '../../prisma/seed/runtime-bootstrap.persistence'
import type {
  RuntimeBootstrapPlan,
} from '../../prisma/seed/runtime-bootstrap.plan'

describe('persistRuntimeBootstrapPlan', () => {
  it('persists only runtime entities and preserves verified provenance', async () => {
    const sourceUpdate = jest.fn(() => Promise.resolve({}))
    const sourceCreate = jest.fn(() => Promise.resolve({}))
    const relationUpdate = jest.fn(() => Promise.resolve({}))
    const incidentUpsert = jest.fn(() => Promise.resolve({}))
    const signalUpsert = jest.fn(() => Promise.resolve({}))
    const signalLinkUpsert = jest.fn(() => Promise.resolve({}))
    const candidateUpsert = jest.fn(() => Promise.resolve({}))
    const candidateSourceUpsert = jest.fn(() => Promise.resolve({}))
    const stationUpdate = jest.fn(() => Promise.resolve({}))

    const transaction = {
      sourceDocument: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(
            where.id === 'doc-official'
              ? {
                id: 'doc-official',
                originalUrl: 'https://example.kz/report.pdf',
                canonicalUrl: 'https://example.kz/report.pdf',
                publisher: 'Official Publisher',
                title: 'Old title',
                sourceType: 'official_report',
                mediaType: 'application/pdf',
                publishedAt: null,
                sha256: 'a'.repeat(64),
                fetchedAt:
                  new Date(
                    '2026-08-06T12:00:00.000Z',
                  ),
                cachePath:
                  'sources/doc-official/snapshot.pdf',
                status: SourceDocumentStatus.VERIFIED,
                extractionMetadata: {
                  provenance: 'verified_manifest',
                },
              }
              : null,
          ),
        ),
        update: sourceUpdate,
        create: sourceCreate,
      },
      stationRelation: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: 'station-relation:a:b:upstream-of',
            metadata: {
              provenance: 'verified_manifest',
            },
          }),
        ),
        update: relationUpdate,
      },
      station: {
        update: stationUpdate,
      },
      incident: {
        findUnique: jest.fn(() => Promise.resolve(null)),
        upsert: incidentUpsert,
      },
      incidentSignal: {
        findUnique: jest.fn(() => Promise.resolve(null)),
        upsert: signalUpsert,
      },
      incidentSignalLink: {
        upsert: signalLinkUpsert,
      },
      candidateObject: {
        findUnique: jest.fn(() => Promise.resolve(null)),
        upsert: candidateUpsert,
      },
      candidateObjectSource: {
        upsert: candidateSourceUpsert,
      },
    }

    const client = createPersistenceClient(transaction)

    const verifyPrerequisites = jest.fn(() =>
      Promise.resolve({
        sourceDocuments: 1,
        stations: 2,
        stationRelations: 1,
        stationRelationEvidence: 1,
        measurements: 2,
      }),
    )

    const summary = await persistRuntimeBootstrapPlan(
      client,
      plan(),
      {
        verifyPrerequisites:
          verifyPrerequisites as unknown as (
            transaction: Prisma.TransactionClient,
            plan: RuntimeBootstrapPlan,
          ) => Promise<{
            sourceDocuments: number
            stations: number
            stationRelations: number
            stationRelationEvidence: number
            measurements: number
          }>,
      },
    )

    expect(summary.incidents).toBe(1)
    expect(summary.incidentSignals).toBe(1)
    expect(summary.candidateObjects).toBe(1)

    expect(sourceUpdate).toHaveBeenCalledWith({
      where: { id: 'doc-official' },
      data: {
        title: 'Runtime official title',
        extractionMetadata: objectContaining({
          provenance: 'verified_manifest',
          official: true,
          verified: true,
        }),
      },
    })

    expect(sourceCreate).toHaveBeenCalledWith({
      data: objectContaining({
        id: 'doc-media',
        sourceType: 'media_article',
        mediaType: 'text/html',
        sha256: null,
        cachePath: null,
      }),
    })

    expect(relationUpdate).toHaveBeenCalledWith({
      where: {
        id: 'station-relation:a:b:upstream-of',
      },
      data: {
        metadata: objectContaining({
          provenance: 'verified_manifest',
          comparisonPair: true,
        }),
      },
    })

    expect(incidentUpsert).toHaveBeenCalledWith(
      objectContaining({
        create: objectContaining({
          id: 'inv-test',
          metadata: objectContaining({
            stationRelationIds: [
              'station-relation:a:b:upstream-of',
            ],
            runtimeBootstrap: objectContaining({
              stationFacts: arrayMatcher,
              stationRelationFacts: arrayMatcher,
              candidateObjectFacts: arrayMatcher,
            }),
          }),
        }),
      }),
    )

    expect(candidateUpsert).toHaveBeenCalledWith(
      objectContaining({
        create: objectContaining({
          id: 'candidate-test',
          verificationStatus: 'OFFICIAL',
          basisText: stringContaining(
            'Причинная связь с загрязнением не установлена',
          ),
        }),
      }),
    )
    expect(stationUpdate).not.toHaveBeenCalled()
  })

  it('fails closed when an official prerequisite source disappears', async () => {
    const transaction = {
      sourceDocument: {
        findUnique: jest.fn(() => Promise.resolve(null)),
      },
    }

    const client = createPersistenceClient(transaction)

    await expect(
      persistRuntimeBootstrapPlan(
        client,
        plan(),
        {
          verifyPrerequisites: () =>
            Promise.resolve({
              sourceDocuments: 1,
              stations: 2,
              stationRelations: 1,
              stationRelationEvidence: 1,
              measurements: 2,
            }),
        },
      ),
    ).rejects.toMatchObject({
      code: 'RUNTIME_BOOTSTRAP_PERSISTENCE_CONFLICT',
    })
  })
})

function objectContaining(
  value: Record<string, unknown>,
): unknown {
  return expect.objectContaining(value) as unknown
}

const arrayMatcher: unknown =
  expect.any(Array) as unknown

function stringContaining(
  value: string,
): unknown {
  return expect.stringContaining(value) as unknown
}

function createPersistenceClient(
  transaction: unknown,
): RuntimeBootstrapPersistenceClient {
  return {
    async $transaction<T>(
      operation: (
        transactionClient: Prisma.TransactionClient,
      ) => Promise<T>,
      options: {
        maxWait: number
        timeout: number
      },
    ): Promise<T> {
      expect(options).toEqual({
        maxWait: 10_000,
        timeout: 30_000,
      })

      return operation(
        transaction as Prisma.TransactionClient,
      )
    },
  }
}

function plan(): RuntimeBootstrapPlan {
  return {
    version: 1,
    sourceDocuments: [
      {
        id: 'doc-official',
        title: 'Runtime official title',
        publisher: 'Official Publisher',
        url: 'https://example.kz/report.pdf',
        official: true,
        verified: true,
        publishedAt: null,
        fetchedAt: null,
        contentType: 'pdf',
        sha256: 'a'.repeat(64),
        cachePath: null,
        status: 'unverified',
        inputPaths: ['data/fixtures/investigation/test.json'],
      },
      {
        id: 'doc-media',
        title: 'Media title',
        publisher: 'Media Publisher',
        url: 'https://example.kz/article',
        official: false,
        verified: true,
        publishedAt: '2025-09-09T10:16:00.000Z',
        fetchedAt: null,
        contentType: 'html',
        sha256: null,
        cachePath: null,
        status: 'unverified',
        inputPaths: ['data/fixtures/investigation/test.json'],
      },
    ],
    relations: [
      {
        id: 'station-relation:a:b:upstream-of',
        comparisonPair: true,
        evidenceIds: ['relation-evidence-test'],
        sourceDocumentIds: ['doc-official'],
      },
    ],
    incidents: [
      {
        id: 'inv-test',
        title: 'Test incident',
        region: 'atyrau',
        indicator: 'нефтепродукты',
        status: 'OPEN',
        metadata: {
          unknowns: [],
          stationIds: ['a', 'b'],
          stationRelationIds: [
            'station-relation:a:b:upstream-of',
          ],
          measurementIds: ['measurement-a', 'measurement-b'],
          candidateObjectIds: ['candidate-test'],
          sourceDocumentIds: ['doc-official', 'doc-media'],
          runtimeBootstrap: {
            version: 1,
            inputPath: 'data/fixtures/investigation/test.json',
            expectedResultPath:
              'data/fixtures/investigation/test-golden.json',
            stationRelationEvidenceIds: [
              'relation-evidence-test',
            ],
            stationFacts: [
              {
                id: 'a',
                name: '1 км выше Атырау',
                waterBody: 'Жайык',
              },
              {
                id: 'b',
                name: '1 км ниже Атырау',
                waterBody: 'Жайык',
              },
            ],
            stationRelationFacts: [
              {
                relationId:
                  'station-relation:a:b:upstream-of',
                evidenceId: 'relation-evidence-test',
                sourceDocumentId: 'doc-official',
                basis:
                  'Официальная парная маркировка выше/ниже одного сброса',
                comparisonPair: true,
                provenance: {
                  fixturePath:
                    'data/verified/test-relations.json',
                  sourcePage: 1,
                  sourceExcerpt: 'Verified relation excerpt',
                },
              },
            ],
            candidateObjectFacts: [
              {
                candidateObjectId: 'candidate-test',
                evidenceDocumentIds: ['doc-official'],
              },
            ],
            sourceDocumentFacts: [
              {
                id: 'doc-official',
                title: 'Runtime official title',
                publisher: 'Official Publisher',
                url:
                  'https://example.kz/report.pdf',
                official: true,
                verified: true,
                publishedAt: null,
                fetchedAt: null,
                contentType: 'pdf',
                sha256: 'a'.repeat(64),
                cachePath: null,
                status: 'unverified',
              },
              {
                id: 'doc-media',
                title: 'Media title',
                publisher: 'Media Publisher',
                url:
                  'https://example.kz/article',
                official: false,
                verified: true,
                publishedAt:
                  '2025-09-09T10:16:00.000Z',
                fetchedAt: null,
                contentType: 'html',
                sha256: null,
                cachePath: null,
                status: 'unverified',
              },
            ],
            measurementFacts: [
              {
                id:
                  'measurement-a',
                stationId:
                  'st-asa-0-5km-above',
                indicator:
                  'нефтепродукты',
                matrix:
                  'water',
                value:
                  '0.114',
                rawValueText:
                  '0,114',
                unit:
                  'mg/dm3',
                sampledAt:
                  null,
                sampledPeriod:
                  '2025-05',
                sourceDocumentId:
                  'doc-kazhydromet-2025-05',
                sourcePage:
                  24,
                sourceExcerpt:
                  'Нефтепродукты – 0,114 мг/дм3',
                verified:
                  true,
              },
              {
                id:
                  'measurement-b',
                stationId:
                  'st-asa-0-5km-below',
                indicator:
                  'нефтепродукты',
                matrix:
                  'water',
                value:
                  '0.193',
                rawValueText:
                  '0,193',
                unit:
                  'mg/dm3',
                sampledAt:
                  null,
                sampledPeriod:
                  '2025-05',
                sourceDocumentId:
                  'doc-kazhydromet-2025-05',
                sourcePage:
                  24,
                sourceExcerpt:
                  'Нефтепродукты – 0,193 мг/дм3',
                verified:
                  true,
              },
            ],
            fixtureInputHash: 'b'.repeat(64),
            rulesetVersion: '1.2.1',
            signalAbsenceReason: null,
          },
        },
      },
    ],
    signals: [
      {
        id: 'signal-test',
        title: 'Test signal',
        observedAt: null,
        observedPeriod: '2025-09',
        reportedAt: '2025-09-09T10:16:00.000Z',
        locationText: 'Атырау',
        phenomenon: 'color_change',
        excerpt: 'Test excerpt',
        sourceDocumentId: 'doc-media',
        extractionMode: 'verified_seed',
        verificationStatus: 'corroborated',
        checkedAt: null,
        provenanceStatus: null,
        incidentIds: ['inv-test'],
        inputPaths: ['data/fixtures/investigation/test.json'],
      },
    ],
    signalLinks: [
      {
        incidentId: 'inv-test',
        signalId: 'signal-test',
      },
    ],
    candidateObjects: [
      {
        id: 'candidate-test',
        name: 'Candidate',
        category: 'сброс сточных вод',
        stationId: 'b',
        waterBody: 'Жайык',
        completeness: 'confirmed',
        evidenceDocumentIds: ['doc-official'],
        incidentIds: ['inv-test'],
      },
    ],
    candidateSources: [
      {
        candidateObjectId: 'candidate-test',
        sourceDocumentId: 'doc-official',
      },
    ],
    requiredVerifiedData: {
      sourceDocumentIds: ['doc-official'],
      stationIds: ['a', 'b'],
      stationRelationIds: [
        'station-relation:a:b:upstream-of',
      ],
      stationRelationEvidenceIds: [
        'relation-evidence-test',
      ],
      measurementIds: ['measurement-a', 'measurement-b'],
    },
  }
}
