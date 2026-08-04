import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { HealthLive } from '@caspian-trace/contracts'

import { HealthLiveDto } from './dto/health-live.dto'

@ApiTags('health')
@Controller('health')
export class HealthController {
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
}
