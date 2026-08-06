import { Controller, Param, Post, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import type { InvestigationResult } from '@caspian-trace/investigation-core'

import { IngestionTokenGuard } from '../ingestion/ingestion-token.guard'
import { InvestigationsService } from './investigations.service'

@ApiTags('admin investigations')
@Controller('admin/investigations')
@UseGuards(IngestionTokenGuard)
export class AdminInvestigationsController {
  constructor(private readonly investigations: InvestigationsService) {}

  @Post(':id/recompute')
  @ApiOperation({ summary: 'Recompute and version an investigation' })
  async recompute(@Param('id') id: string): Promise<InvestigationResult> {
    return (await this.investigations.recompute(id)).result
  }
}
