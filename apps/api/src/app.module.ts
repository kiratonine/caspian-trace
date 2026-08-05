import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { validatePlatformEnvironment } from './config/environment'
import { HealthModule } from './health/health.module'
import { IncidentsModule } from './incidents/incidents.module'
import { PrismaModule } from './prisma/prisma.module'
import { SafeFetchModule } from './common/http/safe-fetch.module'
import { SourcesModule } from './sources/sources.module'
import { IngestionModule } from './ingestion/ingestion.module'
import { LiveModule } from './live/live.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validatePlatformEnvironment,
    }),
    PrismaModule,
    HealthModule,
    IncidentsModule,
    SourcesModule,
    SafeFetchModule,
    IngestionModule,
    LiveModule,
  ],
})
export class AppModule {}
