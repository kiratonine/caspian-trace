import { Controller, Get, Param, Query } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import type { IncidentDetail, IncidentSummary } from '@caspian-trace/contracts'

import {
  InvestigationIdDto,
  ListIncidentsDto,
  toIncidentFilters,
} from './dto/list-incidents.dto'
import { IncidentsService } from './incidents.service'

const errorSchema = {
  type: 'object',
  required: ['code', 'message', 'requestId'],
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    requestId: { type: 'string' },
  },
}

const summarySchema = {
  type: 'object',
  required: [
    'id',
    'title',
    'region',
    'evidenceLevel',
    'indicator',
    'updatedAt',
    'period',
  ],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    region: { type: 'string', enum: ['atyrau', 'mangystau'] },
    evidenceLevel: { type: 'string', enum: ['L0', 'L1', 'L2', 'L3'] },
    indicator: { type: 'string' },
    updatedAt: { type: 'string', format: 'date-time' },
    period: {
      type: 'string',
      pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
      nullable: true,
    },
  },
}

const detailSchema = {
  type: 'object',
  required: [
    'investigation',
    'region',
    'signals',
    'measurements',
    'stations',
    'candidateObjects',
    'sourceDocuments',
    'corridorBounds',
  ],
  properties: {
    investigation: { type: 'object' },
    region: { type: 'string', enum: ['atyrau', 'mangystau'] },
    signals: { type: 'array', items: { type: 'object' } },
    measurements: { type: 'array', items: { type: 'object' } },
    stations: { type: 'array', items: { type: 'object' } },
    candidateObjects: { type: 'array', items: { type: 'object' } },
    sourceDocuments: { type: 'array', items: { type: 'object' } },
    corridorBounds: { type: 'object', nullable: true },
  },
}

@ApiTags('incidents')
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List current incident investigations' })
  @ApiOkResponse({ schema: { type: 'array', items: summarySchema } })
  @ApiBadRequestResponse({ schema: errorSchema })
  list(@Query() query: ListIncidentsDto): Promise<IncidentSummary[]> {
    return this.incidentsService.list(toIncidentFilters(query))
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a current incident investigation' })
  @ApiOkResponse({ schema: detailSchema })
  @ApiNotFoundResponse({ schema: errorSchema })
  @ApiInternalServerErrorResponse({ schema: errorSchema })
  getOne(@Param() params: InvestigationIdDto): Promise<IncidentDetail> {
    return this.incidentsService.getDetail(params.id)
  }
}
