import { Module } from '@nestjs/common'

import { InvestigationsModule } from '../investigations/investigations.module'
import { ReplaysController } from './replays.controller'
import { ReplaysRepository } from './replays.repository'
import { ReplaysService } from './replays.service'

@Module({
  imports: [InvestigationsModule],
  controllers: [ReplaysController],
  providers: [ReplaysService, ReplaysRepository],
  exports: [ReplaysService],
})
export class ReplaysModule {}
