import { EvidenceGraphSchema } from '@caspian-trace/contracts'
import type {
  InvestigationInput,
  InvestigationResult,
} from '@caspian-trace/investigation-core'

import { FileInvestigationRepository } from '../../src/investigations/file-investigation.repository'
import { parseInvestigationInput } from '../../src/investigations/investigation-input.schema'
import type {
  InvestigationInputReader,
  InvestigationResultWriter,
  StoredInvestigation,
} from '../../src/investigations/investigation.ports'
import { InvestigationsService } from '../../src/investigations/investigations.service'

describe('InvestigationsService', () => {
  it('recomputes idempotently and returns provenance-valid evidence', async () => {
    const repository = new FileInvestigationRepository()
    const service = new InvestigationsService(repository, repository)

    const first = await service.recompute('inv-atyrau-2025-09')
    const second = await service.recompute('inv-atyrau-2025-09')
    expect(second).toEqual(first)

    const graph = EvidenceGraphSchema.parse(
      await service.getEvidenceGraph('inv-atyrau-2025-09'),
    )
    expect(graph.statements.length).toBeGreaterThan(0)
    expect(
      graph.statements.every(
        ({ kind, sourceDocumentIds }) =>
          kind === 'unknown' || sourceDocumentIds.length > 0,
      ),
    ).toBe(true)
  })

  it('serves the current snapshot without loading input or saving a version', async () => {
    const repository = new FileInvestigationRepository()
    const service = new InvestigationsService(repository, repository)
    const current = await service.recompute('inv-atyrau-2025-09')
    const loadInput = jest.spyOn(repository, 'loadInput')
    const saveVersioned = jest.spyOn(repository, 'saveVersioned')

    await expect(service.getStored('inv-atyrau-2025-09')).resolves.toEqual(current)
    await expect(service.getCurrentResult('inv-atyrau-2025-09')).resolves.toEqual(
      current.result,
    )
    await expect(service.getEvidenceGraph('inv-atyrau-2025-09')).resolves.toMatchObject({
      investigationId: 'inv-atyrau-2025-09',
    })
    expect(loadInput).not.toHaveBeenCalled()
    expect(saveVersioned).not.toHaveBeenCalled()
  })

  it('does not implicitly create a result from a fixture on a public read', async () => {
    const repository = new FileInvestigationRepository()
    const service = new InvestigationsService(repository, repository)

    await expect(service.getStored('inv-atyrau-2025-09')).rejects.toMatchObject({
      status: 404,
    })
    await expect(repository.findCurrent('inv-atyrau-2025-09')).resolves.toBeNull()
  })

  it('creates a new version when the input changes', async () => {
    const fixtureRepository = new FileInvestigationRepository()
    const initial = await fixtureRepository.loadInput('inv-atyrau-2025-05')
    expect(initial).not.toBeNull()
    const reader = new MutableReader(initial!)
    const writer = new RecordingWriter()
    const service = new InvestigationsService(reader, writer)

    const first = await service.recompute(initial!.incident.id)
    reader.input = {
      ...initial!,
      incident: { ...initial!.incident, title: `${initial!.incident.title} updated` },
    }
    const second = await service.recompute(initial!.incident.id)
    expect(second.id).not.toBe(first.id)
    expect(writer.versions).toHaveLength(2)
  })

  it('returns a typed 404 for an unknown investigation', async () => {
    const repository = new FileInvestigationRepository()
    const service = new InvestigationsService(repository, repository)
    await expect(service.recompute('missing')).rejects.toMatchObject({ status: 404 })
  })

  it('keeps the current version unchanged when an atomic save fails', async () => {
    const repository = new FileInvestigationRepository()
    const initial = await repository.loadInput('inv-atyrau-2025-05')
    expect(initial).not.toBeNull()
    const firstResult = await new InvestigationsService(
      repository,
      repository,
    ).recompute(initial!.incident.id)
    const invalidChangedInput = {
      ...initial!,
      incident: { ...initial!.incident, title: `${initial!.incident.title} changed` },
      uncloneable: (): void => undefined,
    } as unknown as InvestigationInput

    await expect(
      Promise.resolve().then(() =>
        repository.saveVersioned(
          initial!.incident.id,
          invalidChangedInput,
          { ...firstResult.result, inputHash: 'a'.repeat(64) },
        ),
      ),
    ).rejects.toThrow()
    await expect(repository.findCurrent(initial!.incident.id)).resolves.toEqual(
      firstResult,
    )
  })

  it('rejects dangling fixture provenance before rule evaluation', async () => {
    const repository = new FileInvestigationRepository()
    const input = await repository.loadInput('inv-atyrau-2025-05')
    expect(input).not.toBeNull()

    expect(() =>
      parseInvestigationInput({
        ...input!,
        stationRelations: input!.stationRelations.map((relation) => ({
          ...relation,
          sourceDocumentId: 'missing-source',
        })),
      }),
    ).toThrow('RELATION_SOURCE_NOT_FOUND')
  })

  it('deduplicates concurrent saves for the same input and ruleset', async () => {
    const repository = new FileInvestigationRepository()
    const service = new InvestigationsService(repository, repository)
    const [first, second] = await Promise.all([
      service.recompute('inv-atyrau-2025-09'),
      service.recompute('inv-atyrau-2025-09'),
    ])

    expect(second).toEqual(first)
    await expect(repository.findCurrent('inv-atyrau-2025-09')).resolves.toEqual(first)
  })
})

class MutableReader implements InvestigationInputReader {
  constructor(public input: InvestigationInput) {}

  loadInput(): Promise<InvestigationInput> {
    return Promise.resolve(structuredClone(this.input))
  }
}

class RecordingWriter implements InvestigationResultWriter {
  readonly versions: StoredInvestigation[] = []

  findCurrent(): Promise<StoredInvestigation | null> {
    return Promise.resolve(this.versions.at(-1) ?? null)
  }

  saveVersioned(
    investigationId: string,
    input: InvestigationInput,
    result: InvestigationResult,
  ): Promise<StoredInvestigation> {
    const stored: StoredInvestigation = {
      id: `${investigationId}-${this.versions.length + 1}`,
      investigationId,
      input,
      result,
      generatedAt: '2026-08-04T00:00:00.000Z',
      isCurrent: true,
    }
    this.versions.push(stored)
    return Promise.resolve(stored)
  }
}
