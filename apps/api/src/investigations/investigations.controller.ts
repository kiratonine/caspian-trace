import { Controller, Get, Param } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'

import type { EvidenceGraph } from '@caspian-trace/contracts'

import { InvestigationsService } from './investigations.service'

@ApiTags('investigations')
@Controller('investigations')
export class InvestigationsController {
  constructor(private readonly investigations: InvestigationsService) {}

  @Get(':id/evidence')
  @ApiOperation({ summary: 'Return the complete evidence graph' })
  getEvidence(@Param('id') id: string): Promise<EvidenceGraph> {
    return this.investigations.getEvidenceGraph(id)
  }
}
