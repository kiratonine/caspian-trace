import { Module } from '@nestjs/common'

import { SourcesModule } from '../sources/sources.module'
import { LiveController } from './live.controller'
import { LiveService } from './live.service'

@Module({
  imports: [SourcesModule],
  controllers: [LiveController],
  providers: [LiveService],
  exports: [LiveService],
})
export class LiveModule { }