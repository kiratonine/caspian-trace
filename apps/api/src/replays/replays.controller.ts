import { Controller, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import type { ReplayScenario } from '@caspian-trace/contracts'

import { ReplaysService } from './replays.service'

@ApiTags('replays')
@Controller('replays')
export class ReplaysController {
  constructor(private readonly replays: ReplaysService) {}

  @Post(':id/start')
  @ApiOperation({ summary: 'Return an immutable deterministic replay scenario' })
  start(@Param('id') id: string): Promise<ReplayScenario> {
    return this.replays.start(id)
  }
}
