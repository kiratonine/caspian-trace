import { Module } from '@nestjs/common'

import { LiveController } from './live.controller'
import { LiveRepository } from './live.repository'
import { LiveService } from './live.service'

@Module({
  controllers: [LiveController],
  providers: [LiveRepository, LiveService],
  exports: [LiveService],
})
export class LiveModule {}
