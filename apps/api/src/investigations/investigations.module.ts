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

@Module({
  controllers: [InvestigationsController, AdminInvestigationsController],
  providers: [
    FileInvestigationRepository,
    {
      provide: INVESTIGATION_INPUT_READER,
      useExisting: FileInvestigationRepository,
    },
    {
      provide: INVESTIGATION_RESULT_WRITER,
      useExisting: FileInvestigationRepository,
    },
    InvestigationsService,
    IngestionTokenGuard,
  ],
  exports: [InvestigationsService],
})
export class InvestigationsModule {}
