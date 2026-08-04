import { Controller, Get } from '@nestjs/common'
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger'
import type { HealthLive, HealthReady } from '@caspian-trace/contracts'

import { HealthLiveDto } from './dto/health-live.dto'
import { HealthReadyDto } from './dto/health-ready.dto'
import { HealthService } from './health.service'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness probe' })
  @ApiOkResponse({
    type: HealthLiveDto,
    headers: {
      'x-request-id': {
        description: 'Request correlation identifier',
        schema: { type: 'string' },
      },
    },
  })
  live(): HealthLive {
    return { status: 'ok', service: 'caspian-trace-api' }
  }

  @Get('ready')
  @ApiOperation({ summary: 'Database readiness probe' })
  @ApiOkResponse({ type: HealthReadyDto })
  @ApiServiceUnavailableResponse({
    description: 'Database is unavailable or the readiness query timed out',
  })
  ready(): Promise<HealthReady> {
    return this.healthService.ready()
  }
}
