import { Module } from '@nestjs/common'

import { InvestigationsModule } from '../investigations/investigations.module'
import { ExportController } from './export.controller'
import { ExportService } from './export.service'

@Module({
  imports: [InvestigationsModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
