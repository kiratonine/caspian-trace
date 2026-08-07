import { Injectable } from '@nestjs/common'

import {
  EvidenceLevel as PrismaEvidenceLevel,
  Region as PrismaRegion,
} from '../generated/prisma/enums'
import { PrismaService } from '../prisma/prisma.service'
import {
  incidentDetailSelect,
  incidentSummarySelect,
  type IncidentDetailRow,
  type IncidentFilters,
  type IncidentSummaryRow,
} from './incidents.types'

@Injectable()
export class IncidentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(filters: IncidentFilters): Promise<IncidentSummaryRow[]> {
    const generatedAt =
      filters.generatedFrom || filters.generatedBefore
        ? {
            gte: filters.generatedFrom,
            lt: filters.generatedBefore,
          }
        : undefined

    return this.prisma.investigation.findMany({
      where: {
        isCurrent: true,
        evidenceLevel: filters.status
          ? mapEvidenceLevelFilter(filters.status)
          : undefined,
        incident: filters.region
          ? { region: mapRegionFilter(filters.region) }
          : undefined,
        generatedAt,
      },
      orderBy: [{ generatedAt: 'desc' }, { id: 'asc' }],
      take: filters.limit,
      select: incidentSummarySelect,
    })
  }

  findDetail(investigationId: string): Promise<IncidentDetailRow | null> {
    return this.prisma.investigation.findFirst({
      where: {
        isCurrent: true,
        OR: [
          { id: investigationId },
          { incidentId: investigationId },
        ],
      },
      select: incidentDetailSelect,
    })
  }
}

function mapEvidenceLevelFilter(
  value: NonNullable<IncidentFilters['status']>,
): PrismaEvidenceLevel {
  switch (value) {
    case 'L0':
      return PrismaEvidenceLevel.L0
    case 'L1':
      return PrismaEvidenceLevel.L1
    case 'L2':
      return PrismaEvidenceLevel.L2
    case 'L3':
      return PrismaEvidenceLevel.L3
  }
}

function mapRegionFilter(
  value: NonNullable<IncidentFilters['region']>,
): PrismaRegion {
  switch (value) {
    case 'atyrau':
      return PrismaRegion.ATYRAU
    case 'mangystau':
      return PrismaRegion.MANGYSTAU
  }
}
