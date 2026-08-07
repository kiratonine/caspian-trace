import { Test } from '@nestjs/testing'

import { EvidenceLevel, Region } from '../../src/generated/prisma/enums'
import { IncidentsRepository } from '../../src/incidents/incidents.repository'
import {
  incidentDetailSelect,
  incidentSummarySelect,
} from '../../src/incidents/incidents.types'
import { PrismaService } from '../../src/prisma/prisma.service'

describe('IncidentsRepository', () => {
  const findMany = jest.fn()
  const findFirst = jest.fn()
  let repository: IncidentsRepository

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IncidentsRepository,
        {
          provide: PrismaService,
          useValue: { investigation: { findMany, findFirst } },
        },
      ],
    }).compile()
    repository = module.get(IncidentsRepository)
    findMany.mockReset().mockResolvedValue([])
    findFirst.mockReset().mockResolvedValue(null)
  })

  it('uses one explicit current-investigation list query with mapped filters', async () => {
    await repository.findMany({
      status: 'L2',
      region: 'atyrau',
      generatedFrom: new Date('2025-01-01T00:00:00.000Z'),
      generatedBefore: new Date('2026-01-01T00:00:00.000Z'),
      limit: 12,
    })

    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledWith({
      where: {
        isCurrent: true,
        evidenceLevel: EvidenceLevel.L2,
        incident: { region: Region.ATYRAU },
        generatedAt: {
          gte: new Date('2025-01-01T00:00:00.000Z'),
          lt: new Date('2026-01-01T00:00:00.000Z'),
        },
      },
      orderBy: [{ generatedAt: 'desc' }, { id: 'asc' }],
      take: 12,
      select: incidentSummarySelect,
    })
  })

  it('accepts a version ID or stable incident alias and restricts detail to current results', async () => {
    await repository.findDetail('test-part04-incident')
    expect(findFirst).toHaveBeenCalledTimes(1)
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        isCurrent: true,
        OR: [
          { id: 'test-part04-incident' },
          { incidentId: 'test-part04-incident' },
        ],
      },
      select: incidentDetailSelect,
    })
  })
})
