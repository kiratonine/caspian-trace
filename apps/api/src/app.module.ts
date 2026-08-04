import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { validatePlatformEnvironment } from './config/environment'
import { ExportModule } from './export/export.module'
import { HealthModule } from './health/health.module'
import { InvestigationsModule } from './investigations/investigations.module'
import { LlmModule } from './llm/llm.module'
import { ReplaysModule } from './replays/replays.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validatePlatformEnvironment,
    }),
    HealthModule,
    InvestigationsModule,
    ReplaysModule,
    ExportModule,
    LlmModule,
  ],
})
export class AppModule {}
