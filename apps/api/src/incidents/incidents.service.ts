import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import type { IncidentDetail, IncidentSummary } from '@caspian-trace/contracts'

import { IncidentDataInvalidError } from './incidents.errors'
import { mapIncidentDetail, mapIncidentSummary } from './incidents.mapper'
import { IncidentsRepository } from './incidents.repository'
import type { IncidentFilters } from './incidents.types'

@Injectable()
export class IncidentsService {
  constructor(private readonly incidentsRepository: IncidentsRepository) {}

  async list(filters: IncidentFilters): Promise<IncidentSummary[]> {
    const rows = await this.incidentsRepository.findMany(filters)
    try {
      return rows.map(mapIncidentSummary)
    } catch (error) {
      this.rethrowDataError(error)
    }
  }

  async getDetail(investigationId: string): Promise<IncidentDetail> {
    const row = await this.incidentsRepository.findDetail(investigationId)
    if (!row) {
      throw new NotFoundException({
        code: 'INVESTIGATION_NOT_FOUND',
        message: 'Investigation not found',
      })
    }
    try {
      return mapIncidentDetail(row)
    } catch (error) {
      this.rethrowDataError(error)
    }
  }

  private rethrowDataError(error: unknown): never {
    if (error instanceof IncidentDataInvalidError) {
      throw new InternalServerErrorException({
        code: 'INCIDENT_DATA_INVALID',
        message: 'Incident data is inconsistent',
      })
    }
    throw error
  }
}
