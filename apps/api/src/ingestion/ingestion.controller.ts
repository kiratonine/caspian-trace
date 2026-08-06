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
import { RunGdeltIngestionDto } from './dto/run-gdelt-ingestion.dto'
import { IngestionTokenGuard } from './ingestion-token.guard'
import type { KazhydrometIngestionResponse } from './ingestion.types'
import { KazhydrometIngestionService } from './kazhydromet/kazhydromet-ingestion.service'
import { GdeltIngestionService } from './gdelt/gdelt-ingestion.service'
import type { GdeltIngestionResponse } from './ingestion.types'

@ApiTags('admin ingestion')
@Controller('admin/ingestion')
export class IngestionController {
  constructor(
    private readonly kazhydromet: KazhydrometIngestionService,
    private readonly gdelt: GdeltIngestionService,
  ) {}

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

  @Post('gdelt')
  @HttpCode(200)
  @UseGuards(IngestionTokenGuard)
  @ApiOperation({
    summary: 'Cache bounded public articles from fixed GDELT/direct sources (internal admin)',
    description: 'Raw article snapshots remain unverified and no incident signals are created.',
  })
  @ApiHeader({ name: 'X-Ingestion-Token', required: true })
  @ApiOkResponse({
    description: 'GDELT/direct ingestion result with immutable article provenance',
    schema: {
      type: 'object',
      required: ['status', 'gdelt', 'directFallback', 'documents'],
      properties: {
        status: { type: 'string', enum: ['succeeded', 'partial', 'failed', 'rate_limited'] },
        gdelt: {
          type: 'object',
          required: ['runId', 'status', 'sourceStatus', 'cacheStatus', 'discoveredCount', 'allowedCandidateCount', 'acceptedCount', 'rejectedCount'],
          properties: {
            runId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['succeeded', 'partial', 'failed', 'rate_limited'] },
            sourceStatus: { type: 'string', enum: ['healthy', 'degraded', 'rate_limited'], nullable: true },
            cacheStatus: { type: 'string', enum: ['miss', 'fresh', 'stale'], nullable: true },
            discoveredCount: { type: 'integer', minimum: 0 },
            allowedCandidateCount: { type: 'integer', minimum: 0 },
            acceptedCount: { type: 'integer', minimum: 0 },
            rejectedCount: { type: 'integer', minimum: 0 },
          },
        },
        directFallback: {
          type: 'object',
          required: ['used', 'runId', 'status', 'attemptedCount', 'acceptedCount', 'rejectedCount'],
          properties: {
            used: { type: 'boolean' },
            runId: { type: 'string', format: 'uuid', nullable: true },
            status: { type: 'string', enum: ['succeeded', 'partial', 'failed', 'rate_limited'], nullable: true },
            attemptedCount: { type: 'integer', minimum: 0 },
            acceptedCount: { type: 'integer', minimum: 0 },
            rejectedCount: { type: 'integer', minimum: 0 },
          },
        },
        documents: {
          type: 'array',
          items: {
            type: 'object',
            required: ['sourceDocumentId', 'discoveryMode', 'publisher', 'title', 'canonicalUrl', 'publishedAt', 'sha256', 'cachePath', 'parserStatus', 'relevant', 'matchedRequestedRegions', 'coverage'],
            properties: {
              sourceDocumentId: { type: 'string' },
              discoveryMode: { type: 'string', enum: ['gdelt', 'direct_fallback'] },
              publisher: { type: 'string' },
              title: { type: 'string' },
              canonicalUrl: { type: 'string', format: 'uri' },
              publishedAt: { type: 'string', format: 'date-time', nullable: true },
              sha256: { type: 'string' },
              cachePath: { type: 'string' },
              parserStatus: { type: 'string', enum: ['succeeded', 'failed'] },
              relevant: { type: 'boolean', nullable: true },
              matchedRequestedRegions: {
                type: 'array', nullable: true,
                items: { type: 'string', enum: ['atyrau', 'mangystau'] },
              },
              coverage: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid fixed-window ingestion request' })
  @ApiUnauthorizedResponse({ description: 'Invalid ingestion credentials' })
  @ApiServiceUnavailableResponse({ description: 'Controlled upstream or storage failure' })
  runGdelt(@Body() dto: RunGdeltIngestionDto): Promise<GdeltIngestionResponse> {
    return this.gdelt.run(dto)
  }
}
