import { Module } from '@nestjs/common'

import { AdminInvestigationsController } from './admin-investigations.controller'
import { FileInvestigationRepository } from './file-investigation.repository'
import { IngestionTokenGuard } from './ingestion-token.guard'
import {
  INVESTIGATION_INPUT_READER,
  INVESTIGATION_RESULT_WRITER,
} from './investigation.ports'
import { InvestigationsController } from './investigations.controller'
import { InvestigationsService } from './investigations.service'
import { PrismaInvestigationRepository } from './prisma-investigation.repository'

@Module({
  controllers: [InvestigationsController, AdminInvestigationsController],
  providers: [
    FileInvestigationRepository,
    PrismaInvestigationRepository,
    {
      provide: INVESTIGATION_INPUT_READER,
      useExisting: PrismaInvestigationRepository,
    },
    {
      provide: INVESTIGATION_RESULT_WRITER,
      useExisting: PrismaInvestigationRepository,
    },
    InvestigationsService,
    IngestionTokenGuard,
  ],
  exports: [InvestigationsService],
})
export class InvestigationsModule {}
