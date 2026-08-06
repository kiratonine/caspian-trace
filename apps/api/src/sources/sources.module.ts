import { Module } from '@nestjs/common'

import { SourcesController } from './sources.controller'
import { SourceHealthRepository } from './source-health/source-health.repository'
import { SourceHealthService } from './source-health/source-health.service'
import { SourcesRepository } from './sources.repository'
import { SourcesService } from './sources.service'
import { SOURCE_STORAGE } from './storage/storage.constants'
import { SupabaseStorageService } from './storage/supabase-storage.service'

@Module({
  controllers: [SourcesController],
  providers: [
    SourcesRepository,
    SourcesService,
    SourceHealthRepository,
    SourceHealthService,
    SupabaseStorageService,
    {
      provide: SOURCE_STORAGE,
      useExisting: SupabaseStorageService,
    },
  ],
  exports: [
    SourcesService,
    SourceHealthService,
  ],
})
export class SourcesModule { }