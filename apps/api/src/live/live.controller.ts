import { Controller, Get } from '@nestjs/common'
import { ApiInternalServerErrorResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import type { LiveStatus } from '@caspian-trace/contracts'

import { LiveService } from './live.service'

@ApiTags('live sources')
@Controller('live')
export class LiveController {
  constructor(private readonly live: LiveService) {}

  @Get('status')
  @ApiOperation({ summary: 'Read public source health and durable cache availability' })
  @ApiOkResponse({
    schema: {
      type: 'object', required: ['sources'],
      properties: {
        sources: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'name', 'lastSuccessAt', 'cacheAvailable', 'status'],
            properties: {
              id: { type: 'string' }, name: { type: 'string' },
              lastSuccessAt: { type: 'string', format: 'date-time', nullable: true },
              cacheAvailable: { type: 'boolean' },
              status: { type: 'string', enum: ['never_run', 'healthy', 'degraded', 'rate_limited', 'failed'] },
            },
          },
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({ description: 'Normalized internal failure' })
  getStatus(): Promise<LiveStatus> {
    return this.live.getStatus()
  }
}
