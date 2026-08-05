import { InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { IncidentDataInvalidError } from '../../src/incidents/incidents.errors'
import * as incidentsMapper from '../../src/incidents/incidents.mapper'
import { IncidentsRepository } from '../../src/incidents/incidents.repository'
import { IncidentsService } from '../../src/incidents/incidents.service'
import { makeDetailRow, makeSummaryRow } from './incidents-row.fixture'

describe('IncidentsService', () => {
  const findMany = jest.fn()
  const findDetail = jest.fn()
  let service: IncidentsService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IncidentsService,
        {
          provide: IncidentsRepository,
          useValue: { findMany, findDetail },
        },
      ],
    }).compile()
    service = module.get(IncidentsService)
    findMany.mockReset()
    findDetail.mockReset()
  })

  it('maps repository summaries', async () => {
    findMany.mockResolvedValue([makeSummaryRow()])
    await expect(service.list({ limit: 50 })).resolves.toHaveLength(1)
  })

  it('returns a stable not-found exception for missing current investigation', async () => {
    findDetail.mockResolvedValue(null)
    await expect(service.getDetail('missing')).rejects.toMatchObject({
      constructor: NotFoundException,
      response: {
        code: 'INVESTIGATION_NOT_FOUND',
        message: 'Investigation not found',
      },
    })
  })

  it('normalizes persisted-data mapping failures', async () => {
    findDetail.mockResolvedValue(makeDetailRow())
    jest
      .spyOn(incidentsMapper, 'mapIncidentDetail')
      .mockImplementationOnce(() => {
        throw new IncidentDataInvalidError()
      })

    await expect(service.getDetail('invalid')).rejects.toMatchObject({
      constructor: InternalServerErrorException,
      response: {
        code: 'INCIDENT_DATA_INVALID',
        message: 'Incident data is inconsistent',
      },
    })
  })
})
