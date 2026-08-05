import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { RunKazhydrometIngestionDto } from './dto/run-kazhydromet-ingestion.dto'
import { IngestionTokenGuard } from './ingestion-token.guard'
import type { KazhydrometIngestionResponse } from './ingestion.types'
import { KazhydrometIngestionService } from './kazhydromet/kazhydromet-ingestion.service'

@ApiTags('admin ingestion')
@Controller('admin/ingestion')
export class IngestionController {
  constructor(private readonly kazhydromet: KazhydrometIngestionService) {}

  @Post('kazhydromet')
  @HttpCode(200)
  @UseGuards(IngestionTokenGuard)
  @ApiOperation({
    summary: 'Discover and cache Kazhydromet bulletins (internal admin)',
    description: 'Extracted values remain unverified candidates and are never written as measurements.',
  })
  @ApiHeader({ name: 'X-Ingestion-Token', required: true })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['runId', 'status', 'discoveredCount', 'fetchedCount', 'cachedCount', 'pageCount', 'validatedCandidateCount', 'rejectedCandidateCount', 'documents'],
      properties: {
        runId: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: ['succeeded', 'partial', 'failed', 'rate_limited'] },
        discoveredCount: { type: 'integer', minimum: 0 },
        fetchedCount: { type: 'integer', minimum: 0 },
        cachedCount: { type: 'integer', minimum: 0 },
        pageCount: { type: 'integer', minimum: 0 },
        validatedCandidateCount: { type: 'integer', minimum: 0 },
        rejectedCandidateCount: { type: 'integer', minimum: 0 },
        documents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sourceDocumentId: { type: 'string' },
              period: { type: 'string', nullable: true },
              regions: { type: 'array', items: { type: 'string', enum: ['atyrau', 'mangystau'] } },
              sha256: { type: 'string' },
              cachePath: { type: 'string' },
              pageCount: { type: 'integer' },
              relevantPageNumbers: { type: 'array', items: { type: 'integer' } },
              validatedCandidateCount: { type: 'integer' },
              parserStatus: { type: 'string', enum: ['succeeded', 'partial', 'failed'] },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid period, region, range, or limit' })
  @ApiUnauthorizedResponse({ description: 'Invalid ingestion credentials' })
  @ApiServiceUnavailableResponse({ description: 'Controlled upstream or storage failure' })
  runKazhydromet(
    @Body() dto: RunKazhydrometIngestionDto,
  ): Promise<KazhydrometIngestionResponse> {
    return this.kazhydromet.run(dto)
  }
}
