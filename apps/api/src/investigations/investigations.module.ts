import { Module } from '@nestjs/common'

import { IngestionModule } from '../ingestion/ingestion.module'
import { AdminInvestigationsController } from './admin-investigations.controller'
import {
  INVESTIGATION_INPUT_READER,
  INVESTIGATION_RESULT_WRITER,
} from './investigation.ports'
import { InvestigationsController } from './investigations.controller'
import { InvestigationsService } from './investigations.service'
import { PrismaInvestigationRepository } from './prisma-investigation.repository'

@Module({
  imports: [IngestionModule],
  controllers: [InvestigationsController, AdminInvestigationsController],
  providers: [
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
  ],
  exports: [InvestigationsService],
})
export class InvestigationsModule {}
